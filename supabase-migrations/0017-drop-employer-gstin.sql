-- GSTIN collection was never load-bearing: it wasn't required at signup,
-- wasn't verified against GST records, and wasn't used anywhere in the
-- approval or matching flow. Product decision to drop the field entirely
-- rather than keep dead input/display code around it.
alter table employers drop column if exists gstin;
