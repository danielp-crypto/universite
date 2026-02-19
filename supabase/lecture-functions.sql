-- Additional functions for lecture management
-- Run this after the main schema.sql

-- Helper function for executing SQL queries via PostgREST
create or replace function public.execute_sql(query text, params jsonb default '[]'::jsonb)
returns table(id uuid, user_id uuid, title text, description text, duration_seconds int, 
               file_path text, file_size bigint, mime_type text, transcription text, 
               summary text, status text, created_at timestamptz, updated_at timestamptz,
               favorite boolean, tags text[], segment_count bigint, word_count bigint,
               lecture_id uuid, start_time_seconds int, end_time_seconds int, 
               content text, key_concepts text[])
language plpgsql
security definer
as $$
begin
  -- This is a simplified version that handles basic queries
  -- In production, you'd want more sophisticated SQL execution
  
  if query ~* '^SELECT.*FROM lectures' then
    return query execute public.execute_sql_lectures_query(query, params);
  elsif query ~* '^SELECT.*FROM lecture_segments' then
    return query execute public.execute_sql_segments_query(query, params);
  elsif query ~* '^INSERT INTO lectures' then
    return query execute public.execute_sql_lectures_insert(query, params);
  elsif query ~* '^UPDATE lectures' then
    return query execute public.execute_sql_lectures_update(query, params);
  elsif query ~* '^DELETE FROM lectures' then
    return query execute public.execute_sql_lectures_delete(query, params);
  elsif query ~* '^INSERT INTO lecture_segments' then
    return query execute public.execute_sql_segments_insert(query, params);
  else
    raise exception 'Unsupported query type';
  end if;
end;
$$;

-- Simplified query functions for common operations
create or replace function public.execute_sql_lectures_query(query text, params jsonb)
returns table(id uuid, user_id uuid, title text, description text, duration_seconds int, 
               file_path text, file_size bigint, mime_type text, transcription text, 
               summary text, status text, created_at timestamptz, updated_at timestamptz,
               favorite boolean, tags text[], segment_count bigint, word_count bigint)
language plpgsql
as $$
begin
  -- For now, just return all lectures for the authenticated user
  return query
  select 
    l.*,
    (select count(*) from lecture_segments ls where ls.lecture_id = l.id) as segment_count,
    case 
      when l.transcription is not null and l.transcription != '' then 
        array_length(regexp_split_to_array(l.transcription, '\s'), 1)
      else 0 
    end as word_count
  from lectures l
  where l.user_id = auth.uid()
  order by l.created_at desc;
end;
$$;

create or replace function public.execute_sql_segments_query(query text, params jsonb)
returns table(lecture_id uuid, start_time_seconds int, end_time_seconds int, 
               id uuid, title text, content text, key_concepts text[], created_at timestamptz)
language plpgsql
as $$
begin
  -- Return segments for user's lectures
  return query
  select ls.*
  from lecture_segments ls
  join lectures l on ls.lecture_id = l.id
  where l.user_id = auth.uid()
  order by ls.start_time_seconds;
end;
$$;

create or replace function public.execute_sql_lectures_insert(query text, params jsonb)
returns table(id uuid, created_at timestamptz, updated_at timestamptz)
language plpgsql
as $$
begin
  -- Insert new lecture
  return query
  insert into lectures (user_id, title, description, duration_seconds, file_path, 
                        file_size, mime_type, status, tags)
  values (
    auth.uid(),
    params->>1, -- title
    params->>2, -- description
    (params->>3)::int, -- duration_seconds
    params->>4, -- file_path
    (params->>5)::bigint, -- file_size
    params->>6, -- mime_type
    coalesce(params->>7, 'processing'), -- status
    coalesce(params->>8, '{}') -- tags
  )
  returning id, created_at, updated_at;
end;
$$;

create or replace function public.execute_sql_lectures_update(query text, params jsonb)
returns table(id uuid, user_id uuid, title text, description text, duration_seconds int, 
               file_path text, file_size bigint, mime_type text, transcription text, 
               summary text, status text, created_at timestamptz, updated_at timestamptz,
               favorite boolean, tags text[])
language plpgsql
as $$
declare
  v_lecture_id uuid;
  v_user_id uuid;
begin
  -- Extract lecture_id from params (last parameter)
  v_lecture_id := (params->(jsonb_array_length(params) - 1))::uuid;
  v_user_id := (params->(jsonb_array_length(params) - 2))::uuid;
  
  -- Update lecture (simplified - in production you'd parse the actual update fields)
  update lectures 
  set updated_at = now()
  where id = v_lecture_id and user_id = v_user_id
  returning * into public.execute_sql_lectures_update;
  
  return query select * from lectures where id = v_lecture_id;
end;
$$;

create or replace function public.execute_sql_lectures_delete(query text, params jsonb)
returns table(success boolean)
language plpgsql
as $$
declare
  v_lecture_id uuid;
  v_user_id uuid;
begin
  -- Extract parameters
  v_lecture_id := (params->0)::uuid;
  v_user_id := (params->1)::uuid;
  
  -- Delete lecture
  delete from lectures 
  where id = v_lecture_id and user_id = v_user_id;
  
  return query select true::boolean as success;
end;
$$;

create or replace function public.execute_sql_segments_insert(query text, params jsonb)
returns table(id uuid, created_at timestamptz)
language plpgsql
as $$
begin
  -- Insert new segment
  return query
  insert into lecture_segments (lecture_id, start_time_seconds, end_time_seconds, 
                               title, content, key_concepts)
  values (
    (params->0)::uuid, -- lecture_id
    (params->1)::int, -- start_time_seconds
    (params->2)::int, -- end_time_seconds
    params->>3, -- title
    params->>4, -- content
    coalesce(params->>5, '{}') -- key_concepts
  )
  returning id, created_at;
end;
$$;
