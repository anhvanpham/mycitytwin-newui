import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanAnswer } from '../ui/FutureProjectCatalogue';
import { PLAN_QUESTIONS, PLAN_REPLIES } from './futurePlans';
import type { Catalogue } from './futureCatalogue';
const catalogue = JSON.parse(readFileSync(new URL('../../public/data/future-cbd.json', import.meta.url), 'utf8')) as Catalogue;
const questions = ['overview','location','stages','timing','news','sources'] as const;
describe('written Future Plans answers', () => {
  it('renders a substantive written reply before the sources for all 48 project questions', () => {
    for (const project of catalogue.projects) {
      expect(project.answers).toHaveLength(6);
      for (const question of questions) {
        const answer = project.answers.find(a => a.question_id === question)!;
        expect(answer.body.trim().length).toBeGreaterThan(80);
        expect(answer.body).not.toMatch(/^https?:/);
        const html = renderToStaticMarkup(<PlanAnswer project={project} question={question} />);
        expect(html).toContain('future-catalogue__answer-body');
        const writtenReply = html.match(/class="future-catalogue__answer-body">(.*?)<\/p>/)?.[1];
        expect(writtenReply?.length).toBeGreaterThan(80);
        expect(html.indexOf('future-catalogue__answer-body')).toBeLessThan(html.indexOf('Supporting source'));
      }
    }
  });
  it('retains explanations for every question in both original conversations', () => {
    for (const replies of Object.values(PLAN_REPLIES)) {
      for (const { id } of PLAN_QUESTIONS) {
        expect(replies[id].body.length).toBeGreaterThan(80);
        expect(replies[id].sources.length).toBeGreaterThan(0);
      }
    }
  });
  it('keeps uncertain building schedules distinct from a published developer target', () => {
    const townHall = catalogue.projects.find(p => p.id === 'town-hall-overstation')!;
    expect(townHall.answers.find(a => a.question_id === 'timing')!.body).toContain('does not confirm');
    const library = catalogue.projects.find(p => p.id === 'state-library-overstation')!;
    expect(library.answers.find(a => a.question_id === 'timing')!.body).toContain('early 2029');
  });
});
