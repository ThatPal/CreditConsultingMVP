import cors from '../../../apps/api/node_modules/cors/lib/index.js';
import request from '../../../apps/api/node_modules/supertest/index.js';
import express from '../../../apps/api/node_modules/express/index.js';
import {createPrisma} from '../../../apps/api/src/lib/prisma.js';
import {integrityFixture} from '../../../apps/api/src/commerce/commerceIntegrity.fixture.js';
const url=process.env.DATABASE_URL??'';if(new URL(url).pathname!=='/credit_strategy_rec02_com01a')throw Error('Disposable DB required');
const prisma=createPrisma(url);const f=await integrityFixture(prisma);
await request(f.app()).post('/api/v1/client/checkouts').set('Idempotency-Key','browser-alpha').send({productId:f.product.id}).expect(201);
await request(f.app(f.other)).post('/api/v1/client/checkouts').set('Idempotency-Key','browser-beta').send({productId:f.product.id}).expect(201);
const server=express();server.use(cors({origin:'http://127.0.0.1:5197',credentials:true}));
// Browser harness uses a synthetic staff principal; no production authentication change.
server.get('/api/me',(_req,res)=>res.json({user:{...f.admin,firstName:'Reference',lastName:'Admin',capabilities:['payment.read','payment.manage']}}));
server.get('/api/v1/notifications',(_req,res)=>res.json({notifications:[],unread:0}));
server.use((req,res,next)=>{if(!['GET','OPTIONS','HEAD'].includes(req.method))return res.status(405).json({error:{message:'Read-only browser evidence harness'}});next();});
server.use(f.app(f.admin));server.listen(3017,'127.0.0.1',()=>console.log('Disposable browser API listening on 3017; synthetic principal, real isolated DB, fake providers.'));
