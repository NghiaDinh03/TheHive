UPDATE profiles
SET permissions = ARRAY[
    'manageOrganisation',
    'manageUser',
    'manageCase',
    'manageAlert',
    'manageObservable',
    'manageTask',
    'manageProcedure',
    'managePage',
    'manageConfig',
    'accessTheHiveFS',
    'manageAction'
], updated_at = now()
WHERE lower(name) = 'admin';
