import test from 'node:test';
import assert from 'node:assert/strict';
import {localAdminUser} from '../lib/access.mjs';
test('Quản trị cục bộ không phụ thuộc tài khoản hay cờ đăng nhập',()=>{assert.equal(localAdminUser().role,'admin');assert.equal(localAdminUser().email,'Quản trị tại máy');});
