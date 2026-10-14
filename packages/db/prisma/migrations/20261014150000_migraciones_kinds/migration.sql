-- Migraciones procedures are tracked by number + birth date taken from the profile.
ALTER TYPE "TrackerKind" ADD VALUE 'DNM_DNI';
ALTER TYPE "TrackerKind" ADD VALUE 'DNM_CITIZENSHIP';
