import { normalize } from './mealcheck.mjs';

const MAX_ROWS = 5000;
const HEADER_ROWS = 30;
const CFB_HEADER = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const label = value => normalize(value ?? '').trim().replace(/\s+/g, ' ');
const hasContent = cell => cell?.f != null || cell?.F != null || String(cell?.v ?? '').trim() !== '';

function codeText(cell) {
  if (cell?.t === 's') return String(cell.v).trim();
  if (cell?.t !== 'n' || !Number.isSafeInteger(cell.v) || cell.v < 0 || cell.v >= 1e15) return '';
  const formatted = cell.w?.trim();
  if (!formatted || /^\d+(?:\.\d+)?e[+-]\d+$/i.test(formatted)) return String(cell.v);
  return /^\d+$/.test(formatted) && Number(formatted) === cell.v ? formatted : '';
}

export async function readSchoolRoster(file) {
  if (file.size > 5_000_000) throw Error('Tệp tối đa 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!CFB_HEADER.every((byte, index) => bytes[index] === byte)) {
    throw Error('Tệp Excel .xls không hợp lệ hoặc bị hỏng.');
  }

  const { read, utils } = await import('xlsx');
  let workbook;
  try {
    workbook = read(bytes, {
      type: 'array', dense: true, cellHTML: false, cellFormula: true,
      sheetRows: HEADER_ROWS + MAX_ROWS + 1, sheets: [0],
    });
  } catch {
    throw Error('Không đọc được tệp Excel .xls. Kiểm tra định dạng và mật khẩu của tệp.');
  }
  const sheet = workbook.Sheets?.[workbook.SheetNames[0]];
  const cells = sheet?.['!data'] ?? [];
  const header = cells.slice(0, HEADER_ROWS).findIndex(row => {
    const headings = row?.map(cell => label(cell?.v));
    return headings?.includes('ma hoc sinh') && headings.some(text => ['ho va ten', 'ho ten'].includes(text));
  });
  if (header < 0) throw Error('Không tìm thấy cột Mã học sinh và Họ và tên ở trang đầu.');
  if (utils.decode_range(sheet['!fullref'] ?? sheet['!ref']).e.r >= HEADER_ROWS + MAX_ROWS) {
    throw Error('Tệp vượt giới hạn 5.000 dòng học sinh.');
  }

  const headings = cells[header].map(cell => label(cell?.v));
  if (headings.filter(text => text === 'ma hoc sinh').length !== 1 ||
      headings.filter(text => ['ho va ten', 'ho ten'].includes(text)).length !== 1) {
    throw Error('Trang đầu cần đúng một cột Mã học sinh và một cột Họ và tên.');
  }
  const codeCol = headings.indexOf('ma hoc sinh');
  const nameCol = headings.findIndex(text => ['ho va ten', 'ho ten'].includes(text));
  const ordinalCol = headings.indexOf('stt');
  const classes = new Set();
  for (const row of cells.slice(0, header)) {
    for (const cell of row ?? []) {
      const match = /^lop\s*:\s*(\d{1,2})\s*([a-z][a-z0-9]*)\b\s*(?:[-–—]|$)/.exec(label(cell?.v));
      if (match) classes.add(match[1] + match[2].toUpperCase());
    }
  }
  if (classes.size !== 1) throw Error('Kiểm tra tên lớp ở đầu trang Excel, ví dụ “Lớp: 9B”.');
  const [className] = classes;
  const grade = /^\d+/.exec(className)[0];
  const rows = [];
  const codes = new Set();
  for (let index = header + 1; index < cells.length; index++) {
    const row = cells[index];
    const codeCell = row?.[codeCol];
    const nameCell = row?.[nameCol];
    if (![codeCell, nameCell, row?.[ordinalCol]].some(hasContent)) continue;
    const line = index + 1;
    if ([codeCell, nameCell].some(cell => cell?.f != null || cell?.F != null)) {
      throw Error(`Dòng ${line}: mã và họ tên học sinh phải là giá trị cố định.`);
    }
    const code = codeText(codeCell);
    const name = nameCell?.t === 's' ? String(nameCell.v).trim() : '';
    if (!code || code.length > 150) throw Error(`Dòng ${line}: kiểm tra lại mã học sinh. Hãy lưu mã dưới dạng văn bản.`);
    if (!name || name.length > 150) throw Error(`Dòng ${line}: kiểm tra lại họ và tên.`);
    if (codes.has(code)) throw Error(`Dòng ${line}: mã học sinh trùng trong tệp.`);
    codes.add(code);
    rows.push({ code, name, grade, class: className });
  }
  if (!rows.length) throw Error('Tệp chưa có dòng học sinh.');
  if (rows.length > MAX_ROWS) throw Error('Tệp vượt giới hạn 5.000 dòng học sinh.');
  return { rows, grade, className };
}
