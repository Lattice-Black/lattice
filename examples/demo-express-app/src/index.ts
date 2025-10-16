import express from 'express';
import { LatticePlugin } from '@caryyon/plugin-express';

const app = express();

// Middleware
app.use(express.json());

// Initialize Lattice plugin EARLY so metrics middleware can intercept all routes
const lattice = new LatticePlugin({
  serviceName: 'demo-express-app',
  environment: 'development',
  apiEndpoint: 'http://localhost:8100/api/v1',
  apiKey: 'lattice_584d027d755c2d7a79c2fb84d9274fc9ec961d78742b902c',
  enabled: true,
  autoSubmit: false, // Disabled to avoid hitting service limit on free plan
  onAnalyzed: (metadata) => {
    console.log(`\n✅ Lattice analyzed service: ${metadata.service.name}`);
    console.log(`   - Routes discovered: ${metadata.routes?.length || 0}`);
    console.log(`   - Dependencies discovered: ${metadata.dependencies?.length || 0}`);
  },
  onSubmitted: (response) => {
    console.log(`\n✅ Lattice metadata submitted successfully!`);
    console.log(`   - Service ID: ${response.serviceId}`);
    console.log(`   - Routes processed: ${response.routesProcessed}`);
    console.log(`   - Dependencies processed: ${response.dependenciesProcessed}`);
  },
  onError: (error) => {
    console.error(`\n❌ Lattice error:`, error.message);
  },
});

// Add metrics middleware BEFORE routes so it intercepts all requests
app.use(lattice.createMetricsMiddleware());
console.log('📊 Metrics tracking middleware installed');

// Sample routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from demo app!' });
});

app.get('/users', (req, res) => {
  res.json([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]);
});

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'User' });
});

// New route that calls the order-service
app.get('/users/:id/orders', async (req, res) => {
  try {
    const response = await fetch(`http://localhost:8102/orders/user/${req.params.id}`);
    const orders = await response.json();
    res.json({
      userId: req.params.id,
      orders,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/users', (req, res) => {
  res.status(201).json({ id: 3, name: req.body.name });
});

app.put('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: req.body.name });
});

app.delete('/users/:id', (req, res) => {
  res.status(204).send();
});

app.get('/posts', (req, res) => {
  res.json([
    { id: 1, title: 'First Post' },
    { id: 2, title: 'Second Post' },
  ]);
});

app.get('/posts/:id', (req, res) => {
  res.json({ id: req.params.id, title: 'Post Title' });
});

// Analyze the app and start server
(async () => {
  try {
    await lattice.analyze(app);

    // Start server
    const PORT = 8101;
    app.listen(PORT, () => {
      console.log(`\n🚀 Demo Express app running on http://localhost:${PORT}`);
      console.log(`\nAvailable routes:`);
      console.log(`  GET    http://localhost:${PORT}/`);
      console.log(`  GET    http://localhost:${PORT}/users`);
      console.log(`  GET    http://localhost:${PORT}/users/:id`);
      console.log(`  GET    http://localhost:${PORT}/users/:id/orders (fetches from order-service)`);
      console.log(`  POST   http://localhost:${PORT}/users`);
      console.log(`  PUT    http://localhost:${PORT}/users/:id`);
      console.log(`  DELETE http://localhost:${PORT}/users/:id`);
      console.log(`  GET    http://localhost:${PORT}/posts`);
      console.log(`  GET    http://localhost:${PORT}/posts/:id`);
    });
  } catch (error) {
    console.error('Failed to start app:', error);
    process.exit(1);
  }
})();
