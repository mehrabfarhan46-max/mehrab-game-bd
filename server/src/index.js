import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../env', import.meta.url))
});

const [
  expressModule,
  helmetModule,
  corsModule,
  rateLimitModule,
  dbModule,
  publicModule,
  authModule,
  userAuthModule,
  walletModule,
  adminModule,
  packageModule,
  likesModule,
  paymentModule,
  registrationModule
] = await Promise.all([
  import('express'),
  import('helmet'),
  import('cors'),
  import('express-rate-limit'),
  import('./config/db.js'),
  import('./routes/public.js'),
  import('./routes/auth.js'),
  import('./routes/userAuth.js'),
  import('./routes/wallet.js'),
  import('./routes/admin.js'),
  import('./routes/packages.js'),
  import('./routes/likes.js'),
  import('./routes/payments.js'),
  import('./routes/registrations.js')
]);

const express = expressModule.default;
const helmet = helmetModule.default;
const cors = corsModule.default;
const rateLimit = rateLimitModule.default;
const { query } = dbModule;

const app = express();

app.disable('x-powered-by');
app.use(helmet());

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100kb' }));

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    return res.json({ ok: true, db: 'up' });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return res.status(503).json({ ok: false, db: 'down' });
  }
});

app.use('/api/public', publicModule.default);
app.use('/api/auth', authModule.default);
app.use('/api/user-auth', userAuthModule.default);
app.use('/api/wallet', walletModule.default);
app.use('/api/tournaments', registrationModule.default);

app.use('/api/admin/packages', packageModule.default);
app.use('/api/admin/likes', likesModule.default);
app.use('/api/admin/payments', paymentModule.default);
app.use('/api/admin', adminModule.default);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request body.'
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request body is too large.'
    });
  }

  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.'
  });
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`API on :${port}`);
});
