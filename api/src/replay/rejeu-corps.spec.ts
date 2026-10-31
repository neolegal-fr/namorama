import { Body, Controller, HttpCode, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { parseurDuRejeu } from './parseur-du-rejeu';

/**
 * La limite de corps propre à `/replay` ne doit rien changer ailleurs.
 *
 * Premier essai, le 31/10/2026 : `app.use('/replay', json(...))` faisait
 * croire à Nest qu'un parseur JSON était déjà posé (il cherche une couche
 * nommée `jsonParser`), et Nest n'installait plus le sien. Toutes les autres
 * routes recevaient alors un corps vide — `POST /events` répondait 400.
 */

@Controller()
class Echo {
  @Post('events')
  @HttpCode(200)
  events(@Body() body: unknown) {
    return { recu: body };
  }

  @Post('replay')
  @HttpCode(200)
  replay(@Body() body: { events?: unknown[] }) {
    return { n: body?.events?.length ?? -1 };
  }
}

describe('parseur du rejeu', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [Echo] }).compile();
    // Mêmes options que `main.ts`.
    app = mod.createNestApplication({ rawBody: true });
    app.use('/replay', parseurDuRejeu());
    await app.init();
  });

  afterAll(async () => app.close());

  const gros = (ko: number) => 'x'.repeat(ko * 1024);

  it('laisse le parseur de Nest en place sur les autres routes', async () => {
    const res = await request(app.getHttpServer()).post('/events').send({ name: 'page_viewed' });
    expect(res.status).toBe(200);
    expect(res.body.recu).toEqual({ name: 'page_viewed' });
  });

  it('garde la limite par défaut ailleurs : 900 ko refusés sur /events', async () => {
    const res = await request(app.getHttpServer()).post('/events').send({ pad: gros(900) });
    expect(res.status).toBe(413);
  });

  it('accepte 900 ko sur /replay', async () => {
    const res = await request(app.getHttpServer()).post('/replay').send({ events: [{ pad: gros(900) }] });
    expect(res.status).toBe(200);
    expect(res.body.n).toBe(1);
  });

  it('lit un lot envoyé en text/plain (requête simple, sans OPTIONS préalable)', async () => {
    const res = await request(app.getHttpServer())
      .post('/replay')
      .set('Content-Type', 'text/plain;charset=UTF-8')
      .send(JSON.stringify({ events: [{ type: 3 }, { type: 3 }] }));
    expect(res.status).toBe(200);
    expect(res.body.n).toBe(2);
  });

  it('accepte un instantané lourd (3 Mo) et refuse au-delà de sa propre limite', async () => {
    const lourd = await request(app.getHttpServer()).post('/replay').send({ events: [{ pad: gros(3 * 1024) }] });
    expect(lourd.status).toBe(200);
    const trop = await request(app.getHttpServer()).post('/replay').send({ events: [{ pad: gros(4 * 1024 + 100) }] });
    expect(trop.status).toBe(413);
  });
});
