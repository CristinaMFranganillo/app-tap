-- Desactivar trigger handle_new_user: la edge function crear-usuario
-- se encarga de insertar el profile con todos los datos correctos.
-- El trigger causaba "Database error creating new user" al interferir
-- con la transacción de auth.admin.createUser().
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
