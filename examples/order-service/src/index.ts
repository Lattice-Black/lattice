import express from 'express';
import { LatticePlugin } from '@caryyon/plugin-express';

const app = express();

// Middleware
app.use(express.json());

// Order service routes
app.get('/', (req, res) => {
  res.json({ message: 'Order Service API', version: '1.0.0' });
});

app.get('/orders', (req, res) => {
  res.json([
    { id: 'ord_1', userId: 1, total: 99.99, status: 'completed' },
    { id: 'ord_2', userId: 2, total: 149.99, status: 'pending' },
    { id: 'ord_3', userId: 1, total: 79.99, status: 'shipped' },
  ]);
});

app.get('/orders/:id', (req, res) => {
  res.json({
    id: req.params.id,
    userId: 1,
    items: [
      { productId: 'prod_1', quantity: 2, price: 49.99 },
    ],
    total: 99.99,
    status: 'completed',
    createdAt: '2025-01-15T10:30:00Z',
  });
});

app.get('/orders/user/:userId', (req, res) => {
  res.json([
    { id: 'ord_1', userId: req.params.userId, total: 99.99, status: 'completed' },
    { id: 'ord_3', userId: req.params.userId, total: 79.99, status: 'shipped' },
  ]);
});

app.post('/orders', (req, res) => {
  res.status(201).json({
    id: 'ord_4',
    userId: req.body.userId,
    items: req.body.items,
    total: req.body.total,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
});

app.put('/orders/:id', (req, res) => {
  res.json({
    id: req.params.id,
    status: req.body.status,
    updatedAt: new Date().toISOString(),
  });
});

app.delete('/orders/:id', (req, res) => {
  res.status(204).send();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

// Initialize Lattice plugin (AFTER all routes are defined)
const lattice = new LatticePlugin({
  serviceName: 'order-service',
  environment: 'development',
  apiEndpoint: 'http://localhost:8100/api/v1',
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

// Analyze the app
(async () => {
  try {
    await lattice.analyze(app);

    // Start server
    const PORT = 8102;
    app.listen(PORT, () => {
      console.log(`\n🚀 Order Service running on http://localhost:${PORT}`);
      console.log(`\nAvailable routes:`);
      console.log(`  GET    http://localhost:${PORT}/`);
      console.log(`  GET    http://localhost:${PORT}/health`);
      console.log(`  GET    http://localhost:${PORT}/orders`);
      console.log(`  GET    http://localhost:${PORT}/orders/:id`);
      console.log(`  GET    http://localhost:${PORT}/orders/user/:userId`);
      console.log(`  POST   http://localhost:${PORT}/orders`);
      console.log(`  PUT    http://localhost:${PORT}/orders/:id`);
      console.log(`  DELETE http://localhost:${PORT}/orders/:id`);
    });
  } catch (error) {
    console.error('Failed to start app:', error);
    process.exit(1);
  }
})();
