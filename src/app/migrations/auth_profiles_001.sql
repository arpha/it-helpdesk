-- create table profiles
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  name text,
  employee_id text,
  role text,
  department_id text,
  avatar_url text,
  status boolean,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  primary key (id)
);

alter table public.profiles enable row level security;

-- insert a row into public.profiles when user is created
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, employee_id, role, department_id, avatar_url, status)
  values (new.id, new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'employee_id', new.raw_user_meta_data ->> 'role', new.raw_user_meta_data ->> 'department_id', new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'status');
  return new;
end;
$$;

-- trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- delete a row from public.profiles
create function public.handle_delete_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

-- trigger the function every time a user is deleted
create trigger on_auth_user_delated
  after delete on auth.users
  for each row execute procedure public.handle_delete_user()