/** Hosted, read-only equivalent of backend.py, backed by Cloudflare D1. */
type Row = Record<string, unknown>;
type Value = string | number | null;
interface Result { results: Row[] }
export interface Statement {
  bind(...values: Value[]): Statement;
  all(): Promise<Result>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<Result[]>;
}
export interface FutureEnv {
  FUTURE_DB?: Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const PROJECTS = 'SELECT p.*,s.url AS source_url FROM projects p JOIN sources s ON s.id=p.source_id';
const NEWS = "SELECT n.*,s.url AS source_url,s.publisher,s.published_on,s.verified_on FROM news n JOIN sources s ON s.id=n.source_id WHERE n.review_status='reviewed'";
const MAPS = 'SELECT m.*,s.url AS source_url,s.publisher FROM plan_maps m JOIN sources s ON s.id=m.source_id ORDER BY m.id';

function json(value: unknown, status = 200, head = false): Response {
  return new Response(head ? null : JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
async function rows(db: Database, sql: string, values: Value[] = []): Promise<Row[]> {
  return (await db.prepare(sql).bind(...values).all()).results;
}

async function catalogue(db: Database) {
  // One batch gives a consistent snapshot and avoids a query per project.
  const queries = [
    'SELECT * FROM topics ORDER BY name', PROJECTS + ' ORDER BY p.title',
    'SELECT * FROM project_topics ORDER BY topic_id',
    'SELECT st.*,s.url AS source_url FROM stages st JOIN sources s ON s.id=st.source_id ORDER BY position',
    NEWS + ' ORDER BY s.published_on DESC,n.id',
    "SELECT np.* FROM news_projects np JOIN news n ON n.id=np.news_id WHERE n.review_status='reviewed'",
    'SELECT a.*,s.url AS source_url,s.title AS source_title FROM project_answers a JOIN sources s ON s.id=a.source_id ORDER BY a.question_id',
    MAPS,
  ];
  const [topics, projects, links, stages, news, newsLinks, answers, maps] =
    (await db.batch(queries.map(sql => db.prepare(sql)))).map(result => result.results);
  return { topics, projects: projects.map(project => ({ ...project, id: String(project.id),
    topics: topics.filter(topic => links.some(link => link.project_id === project.id && link.topic_id === topic.id)),
    stages: stages.filter(stage => stage.project_id === project.id),
    news: news.filter(item => newsLinks.some(link => link.project_id === project.id && link.news_id === item.id)),
    answers: answers.filter(answer => answer.project_id === project.id),
    maps: maps.filter(map => map.plan_id === project.id),
  })), news, maps };
}

export async function fetchFuture(request: Request, env: FutureEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/future-api/, '');
  const head = request.method === 'HEAD';
  if (request.method !== 'GET' && !head) {
    const response = json({ error: 'Read-only API; use GET or HEAD' }, 405);
    response.headers.set('Allow', 'GET, HEAD');
    return response;
  }
  if (!['/api/health', '/api/catalogue', '/api/topics', '/api/projects', '/api/news', '/api/spatial-context'].includes(path)
    && !/^\/api\/projects\/[^/]+$/.test(path)) return json({ error: 'Not found' }, 404, head);
  if (path === '/api/spatial-context') {
    const response = await env.ASSETS.fetch(new Request(new URL('/ver-4/data/future-context.json', url), { method: head ? 'HEAD' : 'GET' }));
    if (!response.ok) return json({ error: 'City context unavailable' }, 503, head);
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(head ? null : response.body, { status: 200, headers });
  }
  const db = env.FUTURE_DB;
  if (!db) return json({ error: 'Project database unavailable' }, 503, head);
  try {
    if (path === '/api/health') {
      const [counts] = await rows(db, 'SELECT (SELECT count(*) FROM projects) AS projects,(SELECT count(*) FROM project_answers) AS answers');
      return json({ status: 'ok', database: 'cloudflare-d1', ...counts }, 200, head);
    }
    if (path === '/api/topics') return json(await rows(db, 'SELECT * FROM topics ORDER BY name'), 200, head);
    if (path === '/api/catalogue' || path.startsWith('/api/projects/')) {
      const data = await catalogue(db);
      if (path === '/api/catalogue') return json(data, 200, head);
      const project = data.projects.find(item => item.id === path.slice('/api/projects/'.length));
      return project ? json(project, 200, head) : json({ error: 'Not found' }, 404, head);
    }
    const values: Value[] = [], filters: string[] = [];
    const query = url.searchParams.get('q');
    const topic = url.searchParams.get('topic');
    if (path === '/api/projects') {
      const status = url.searchParams.get('status');
      if (status) { filters.push('p.status=?'); values.push(status); }
      if (topic) { filters.push('EXISTS (SELECT 1 FROM project_topics pt WHERE pt.project_id=p.id AND pt.topic_id=?)'); values.push(topic); }
      if (query) { filters.push('(p.title LIKE ? OR p.summary LIKE ?)'); values.push('%' + query + '%', '%' + query + '%'); }
      const where = filters.length ? ' WHERE ' + filters.join(' AND ') : '';
      return json(await rows(db, PROJECTS + where + ' ORDER BY p.title', values), 200, head);
    }
    const project = url.searchParams.get('project');
    if (project) { filters.push('EXISTS (SELECT 1 FROM news_projects np WHERE np.news_id=n.id AND np.project_id=?)'); values.push(project); }
    if (topic) { filters.push('EXISTS (SELECT 1 FROM news_topics nt WHERE nt.news_id=n.id AND nt.topic_id=?)'); values.push(topic); }
    if (query) { filters.push('(n.title LIKE ? OR n.summary LIKE ?)'); values.push('%' + query + '%', '%' + query + '%'); }
    const where = filters.length ? ' AND ' + filters.join(' AND ') : '';
    return json(await rows(db, NEWS + where + ' ORDER BY s.published_on DESC,n.id', values), 200, head);
  } catch (error) {
    console.error('Future Plans database request failed', error);
    return json({ error: 'Project database temporarily unavailable' }, 503, head);
  }
}
