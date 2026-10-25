-- Legacy materials use public URL fields too. Drop unsafe schemes and remove
-- URL userinfo without retaining it in derived metadata or audit messages.
DO $legacy_material_urls$
DECLARE material_table text;
BEGIN
  FOREACH material_table IN ARRAY ARRAY['CourseMaterial', 'CourseGroupMaterial', 'SubjectMaterial'] LOOP
    EXECUTE format(
      'UPDATE %I SET url = CASE WHEN btrim(url) ~* ''^https?://'' THEN regexp_replace(btrim(url), ''^(https?://)[^/?#]*@'', ''\1'', ''i'') ELSE NULL END, metadata = metadata - ''embeddingIndex'', "updatedAt" = NOW() WHERE url IS NOT NULL AND (btrim(url) !~* ''^https?://'' OR btrim(url) ~* ''^https?://[^/?#]*@'')',
      material_table
    );
  END LOOP;
END
$legacy_material_urls$;
