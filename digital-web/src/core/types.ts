import type { ComponentType } from 'react';

export type PageKind = 'home' | 'order' | 'privacy';
export type Theme = 'light' | 'dark';

export interface ConceptMeta {
  id: string;
  baseTheme: Theme;
}

/** Đường dẫn đã gắn sẵn concept hiện tại — concept KHÔNG tự ghép URL. */
export interface ConceptLinks {
  home: string;
  /** /#<hash> khi ở trang con; '#<hash>' khi đang ở trang chủ */
  section: (hash: string) => string;
  /** trang đặt làm, có thể kèm query (vd 'loai=quan-ly') */
  order: (query?: string) => string;
  privacy: string;
  mailto: string;
}

export interface PageProps {
  meta: ConceptMeta;
  links: ConceptLinks;
  kind: PageKind;
  theme: Theme;
  toggleTheme: () => void;
}

export interface ConceptModule {
  Home: ComponentType<PageProps>;
  Order: ComponentType<PageProps>;
  Privacy: ComponentType<PageProps>;
}
