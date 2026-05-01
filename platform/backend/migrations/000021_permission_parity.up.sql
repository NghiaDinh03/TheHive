UPDATE profiles
SET permissions = ARRAY[
    'accessTheHiveFS',
    'manageAction',
    'manageAlert',
    'manageAnalyse',
    'manageAnalyzerTemplate',
    'manageCase',
    'manageCaseTemplate',
    'manageConfig',
    'manageCustomField',
    'manageObservable',
    'manageObservableTemplate',
    'manageOrganisation',
    'managePage',
    'managePattern',
    'managePlatform',
    'manageProcedure',
    'manageProfile',
    'manageShare',
    'manageTag',
    'manageTask',
    'manageTaxonomy',
    'manageUser'
], updated_at = now()
WHERE lower(name) = 'admin';

UPDATE profiles
SET permissions = array_remove(permissions, 'manageConfig'),
    updated_at = now()
WHERE lower(name) <> 'admin'
  AND 'manageConfig' = ANY(permissions)
  AND NOT 'managePlatform' = ANY(permissions);
