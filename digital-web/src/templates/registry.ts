import type { ComponentType } from 'react';

/** Danh mục bản mẫu. Mỗi mẫu là một thư mục riêng trong src/templates/<slug>/ và được tải lười theo route. */
export interface TemplateEntry {
  slug: string;
  /** Tên doanh nghiệp hư cấu. */
  business: string;
  /** Loại website trong catalog giải pháp. */
  solution: 'ban-hang' | 'dich-vu' | 'dat-lich';
  summary: string;
  load: () => Promise<{ default: ComponentType }>;
}

export const templates: TemplateEntry[] = [
  { slug: 'cua-hang', business: 'Gốm Mộc Lam', solution: 'ban-hang', summary: 'Website bán hàng có giỏ hàng', load: () => import('./cua-hang') },
  { slug: 'dich-vu', business: 'Nhà Én', solution: 'dich-vu', summary: 'Website giới thiệu dịch vụ', load: () => import('./dich-vu') },
  { slug: 'dat-lich', business: 'Chín Giờ', solution: 'dat-lich', summary: 'Website nhận đặt lịch', load: () => import('./dat-lich') },
];

export const findTemplate = (slug: string) => templates.find((t) => t.slug === slug);
