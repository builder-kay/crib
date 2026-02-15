-- Increase storage bucket file-size limits for larger asset uploads.
-- assets: primary downloadable files (videos, zips, etc.)
-- previews: lightweight public preview images

update storage.buckets
set file_size_limit = 536870912
where id = 'assets';

update storage.buckets
set file_size_limit = 20971520
where id = 'previews';
