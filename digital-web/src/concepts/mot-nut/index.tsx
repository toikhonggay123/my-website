import '@fontsource-variable/lexend/wght.css';
import './styles.css';
import type { ConceptModule } from '../../core/types';
import { Home } from './Home';
import { Order, Privacy } from './Pages';

export default { Home, Order, Privacy } satisfies ConceptModule;
