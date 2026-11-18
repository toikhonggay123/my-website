import motNut from './concepts/mot-nut';
import { ConceptFrame, makeLinks, useConceptTheme } from './core/ConceptFrame';
import type { ConceptMeta, PageKind } from './core/types';
import './core/base.css';

const meta = { id: 'mot-nut', baseTheme: 'light' } satisfies ConceptMeta;

export default function Portal({ kind }: { kind: PageKind }) {
  const [theme, toggleTheme] = useConceptTheme(meta);
  const links = makeLinks(kind);
  const Page = kind === 'home' ? motNut.Home : kind === 'order' ? motNut.Order : motNut.Privacy;
  return (
    <ConceptFrame key={kind} meta={meta} kind={kind} theme={theme}>
      <Page meta={meta} links={links} kind={kind} theme={theme} toggleTheme={toggleTheme} />
    </ConceptFrame>
  );
}
