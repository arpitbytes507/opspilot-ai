import app from './app';
import { config } from './config/env';

app.listen(config.port, () => {
  console.info(`OpsPilot API listening on http://localhost:${config.port}`);
});
