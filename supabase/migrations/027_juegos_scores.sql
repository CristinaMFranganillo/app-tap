-- Tabla para guardar partidas de los minijuegos mentales
CREATE TABLE juegos_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo_juego text NOT NULL CHECK (tipo_juego IN ('reflejos', 'lateralidad', 'rompe_platos')),
  valor integer NOT NULL,
  aciertos integer,
  total_rondas integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_juegos_scores_ranking ON juegos_scores(tipo_juego, valor);
CREATE INDEX idx_juegos_scores_user ON juegos_scores(user_id, tipo_juego);

ALTER TABLE juegos_scores ENABLE ROW LEVEL SECURITY;

-- Todos los socios autenticados pueden ver el ranking
CREATE POLICY "juegos_scores_select" ON juegos_scores
  FOR SELECT TO authenticated USING (true);

-- Solo puedes insertar tus propias partidas
CREATE POLICY "juegos_scores_insert" ON juegos_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
