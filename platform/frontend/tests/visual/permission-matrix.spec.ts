import { expect, test } from '@playwright/test';
import { canUse } from '../../src/lib/permissions';

test.describe('UI permission matrix', () => {
  test('admin-style manageConfig can access write UI actions', () => {
    expect(canUse({ permissions: ['manageConfig'] }, 'caseClose')).toBe(true);
    expect(canUse({ permissions: ['manageConfig'] }, 'alertImport')).toBe(true);
    expect(canUse({ permissions: ['manageConfig'] }, 'observableDelete')).toBe(true);
  });

  test('limited case user cannot access alert or observable write actions', () => {
    const user = { permissions: ['manageCase'] };
    expect(canUse(user, 'caseCreate')).toBe(true);
    expect(canUse(user, 'taskAssign')).toBe(true);
    expect(canUse(user, 'alertImport')).toBe(false);
    expect(canUse(user, 'observableAnalyze')).toBe(false);
  });
});
