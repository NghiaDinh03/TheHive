import { expect, test } from '@playwright/test';
import { canUse } from '../../src/lib/permissions';

test.describe('UI permission matrix', () => {
  test('admin-style manageConfig can access config UI actions', () => {
    expect(canUse({ permissions: ['manageConfig'] }, 'configManage')).toBe(true);
    expect(canUse({ permissions: ['manageConfig'] }, 'caseClose')).toBe(false); // requires manageCase
    expect(canUse({ permissions: ['manageConfig'] }, 'alertImport')).toBe(false); // requires manageAlert
  });

  test('managePlatform can access all write UI actions', () => {
    expect(canUse({ permissions: ['managePlatform'] }, 'caseClose')).toBe(true);
    expect(canUse({ permissions: ['managePlatform'] }, 'alertImport')).toBe(true);
    expect(canUse({ permissions: ['managePlatform'] }, 'observableDelete')).toBe(true);
    expect(canUse({ permissions: ['managePlatform'] }, 'adminAudit')).toBe(true);
  });

  test('limited case user cannot access alert or observable write actions', () => {
    const user = { permissions: ['manageCase'] };
    expect(canUse(user, 'caseCreate')).toBe(true);
    expect(canUse(user, 'taskAssign')).toBe(false); // requires manageTask
    expect(canUse(user, 'alertImport')).toBe(false);
    expect(canUse(user, 'observableAnalyze')).toBe(false);
  });

  test('task user can assign tasks but not manage alerts', () => {
    const user = { permissions: ['manageTask'] };
    expect(canUse(user, 'taskAssign')).toBe(true);
    expect(canUse(user, 'taskCreate')).toBe(true);
    expect(canUse(user, 'alertImport')).toBe(false);
    expect(canUse(user, 'caseCreate')).toBe(false);
  });
});
