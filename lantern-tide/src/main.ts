import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import './ui/styles.css';
import { App } from './app';

const app = new App();
// Debug/test hook: lets Playwright (and curious players) inspect and drive the game.
(window as unknown as { __LT: App }).__LT = app;
