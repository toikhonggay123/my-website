import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SCHOOLS,DEFAULT_SCHOOL,PICKER_PATH,decideEntry,findSchool,pickerApplies,pickerHref,productForNext,readCookie,safeNext,schoolCookie,
} from '../lib/schools.mjs';
import {SCHOOL} from '../lib/mealcheck.mjs';

test('Na Rì is the only school and keeps the printed full name unchanged', () => {
  assert.deepEqual(SCHOOLS.map(school => school.slug), ['na-ri']);
  assert.equal(DEFAULT_SCHOOL.shortName, 'Trường PTDTNT Na Rì');
  assert.equal(SCHOOL, 'Trường Phổ thông Dân tộc Nội trú Xã Na Rì');
  assert.equal(findSchool('na-ri'), DEFAULT_SCHOOL);
  for (const bad of ['', 'NA-RI', 'na-ri ', null, undefined, 1, '__proto__', 'constructor']) assert.equal(findSchool(bad), null);
});

test('ClassHub lists exactly the same school slugs', () => {
  const source = fs.readFileSync(new URL('../classhub/src/web/school-choice.ts', import.meta.url), 'utf8');
  const listed = JSON.parse(/SCHOOL_SLUGS = (\[[^\]]*\])/.exec(source)[1].replaceAll("'", '"'));
  assert.deepEqual(listed, SCHOOLS.map(school => school.slug));
  assert.match(source, /'afyllx_truong'/);
  assert.match(source, new RegExp(`'${PICKER_PATH}'`));
});

test('the local loopback app never shows the picker', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', 'LOCALHOST']) {
    assert.equal(pickerApplies(host), false);
    assert.deepEqual(decideEntry({hostname: host}), {action: 'enter', school: DEFAULT_SCHOOL, save: false});
  }
  for (const host of ['edu.afyllx.com', 'afyllx.com', 'my-website.fyllxestonia.workers.dev']) assert.equal(pickerApplies(host), true);
});

test('web visitors without a choice see the picker once, then enter directly', () => {
  const web = {hostname: 'edu.afyllx.com'};
  assert.deepEqual(decideEntry(web), {action: 'choose'});
  assert.deepEqual(decideEntry({...web, stored: 'na-ri'}), {action: 'enter', school: DEFAULT_SCHOOL, save: false});
  assert.deepEqual(decideEntry({...web, stored: 'unknown-school'}), {action: 'choose'});
  assert.deepEqual(decideEntry({...web, param: 'na-ri'}), {action: 'enter', school: DEFAULT_SCHOOL, save: true});
  assert.deepEqual(decideEntry({...web, param: 'nope'}), {action: 'choose'});
});

test('scanners, installed apps and offline pages are never blocked by the picker', () => {
  const web = {hostname: 'edu.afyllx.com'};
  for (const flags of [{scanner: true}, {standalone: true}, {online: false}]) {
    assert.deepEqual(decideEntry({...web, ...flags}), {action: 'enter', school: DEFAULT_SCHOOL, save: true});
  }
});

test('the destination after picking stays inside a known product on the same site', () => {
  assert.equal(safeNext('/mealcheck?tab=students'), '/mealcheck?tab=students');
  assert.equal(safeNext('/quan-tri'), '/quan-tri');
  assert.equal(safeNext('/classhub/w/abc?x=1#top'), '/classhub/w/abc?x=1#top');
  assert.equal(safeNext('/classhub'), '/classhub');
  for (const bad of [
    undefined, '', 'https://evil.example/', '//evil.example/mealcheck', '/\\evil.example', 'javascript:alert(1)',
    '/tai-khoan/api/me', '/classhubx', PICKER_PATH, PICKER_PATH + '?tiep=/mealcheck', '/mealcheck/../tai-khoan',
  ]) assert.equal(safeNext(bad), '/mealcheck', String(bad));
  assert.equal(productForNext('/classhub/gv'), 'ClassHub');
  assert.equal(productForNext('/quan-tri'), 'CheckIn');
  assert.equal(pickerHref('/quan-tri?tab=scanner'), PICKER_PATH + '?tiep=%2Fquan-tri%3Ftab%3Dscanner');
});

test('the choice cookie is readable by both products and secure on HTTPS', () => {
  assert.equal(readCookie('a=1; afyllx_truong=na-ri; b=2'), 'na-ri');
  assert.equal(readCookie('afyllx_truong_old=x'), null);
  assert.equal(readCookie(''), null);
  assert.equal(readCookie('afyllx_truong=%E0%A4%A'), null);
  assert.equal(schoolCookie('na-ri', true), 'afyllx_truong=na-ri; Path=/; Max-Age=31536000; SameSite=Lax; Secure');
  assert.equal(schoolCookie('na-ri', false), 'afyllx_truong=na-ri; Path=/; Max-Age=31536000; SameSite=Lax');
});
