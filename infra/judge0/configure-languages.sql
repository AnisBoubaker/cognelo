DO $judge0_language_configuration$
DECLARE
  configured_c_runtimes integer;
BEGIN
  UPDATE languages
  SET compile_cmd = rtrim(compile_cmd)
    || CASE
      WHEN compile_cmd !~ '(^|[[:space:]])-pthread([[:space:]]|$)' THEN ' -pthread'
      ELSE ''
    END
    || CASE
      WHEN compile_cmd !~ '(^|[[:space:]])-lm([[:space:]]|$)' THEN ' -lm'
      ELSE ''
    END
    || CASE
      WHEN compile_cmd !~ '(^|[[:space:]])-ldl([[:space:]]|$)' THEN ' -ldl'
      ELSE ''
    END
    || CASE
      WHEN compile_cmd !~ '(^|[[:space:]])-lrt([[:space:]]|$)' THEN ' -lrt'
      ELSE ''
    END
  WHERE (name LIKE 'C (%' OR name LIKE 'C++ (%')
    AND is_archived = false
    AND NULLIF(btrim(compile_cmd), '') IS NOT NULL;

  SELECT count(*)
  INTO configured_c_runtimes
  FROM languages
  WHERE (name LIKE 'C (%' OR name LIKE 'C++ (%')
    AND is_archived = false
    AND compile_cmd ~ '(^|[[:space:]])-pthread([[:space:]]|$)'
    AND compile_cmd ~ '(^|[[:space:]])-lm([[:space:]]|$)'
    AND compile_cmd ~ '(^|[[:space:]])-ldl([[:space:]]|$)'
    AND compile_cmd ~ '(^|[[:space:]])-lrt([[:space:]]|$)';

  IF configured_c_runtimes = 0 THEN
    RAISE EXCEPTION 'Judge0 exposes no active C/C++ runtime configured with the required system libraries.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM languages
    WHERE (name LIKE 'C (%' OR name LIKE 'C++ (%')
      AND is_archived = false
      AND (
        compile_cmd IS NULL
        OR btrim(compile_cmd) = ''
        OR compile_cmd !~ '(^|[[:space:]])-pthread([[:space:]]|$)'
        OR compile_cmd !~ '(^|[[:space:]])-lm([[:space:]]|$)'
        OR compile_cmd !~ '(^|[[:space:]])-ldl([[:space:]]|$)'
        OR compile_cmd !~ '(^|[[:space:]])-lrt([[:space:]]|$)'
      )
  ) THEN
    RAISE EXCEPTION 'One or more active Judge0 C/C++ runtimes are missing required system-library flags.';
  END IF;
END
$judge0_language_configuration$;

SELECT id, name, compile_cmd
FROM languages
WHERE (name LIKE 'C (%' OR name LIKE 'C++ (%')
  AND is_archived = false
ORDER BY id;
