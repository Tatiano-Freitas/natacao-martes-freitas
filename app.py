from flask import Flask, render_template, request, jsonify
import sqlite3, os, re

app = Flask(__name__)
# Railway: usa /data (volume persistente) se existir, senão pasta local
_local_data = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
_railway_data = "/data"
_data_dir = _railway_data if os.path.exists(_railway_data) else _local_data
DB = os.path.join(_data_dir, "natacao.db")

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def ts(t):
    if not t: return None
    try:
        p = t.replace(",", ".").split(":")
        return int(p[0]) * 60 + float(p[1])
    except: return None

def init_db():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS atletas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            nome_completo TEXT,
            cor TEXT DEFAULT '#2e75b6',
            cor_clara TEXT DEFAULT '#bdd7ee'
        );
        CREATE TABLE IF NOT EXISTS resultados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            atleta_id INTEGER NOT NULL,
            data TEXT NOT NULL,
            prova TEXT NOT NULL,
            tempo TEXT,
            tempo_segundos REAL,
            piscina INTEGER,
            categoria TEXT,
            evento TEXT,
            obs TEXT,
            periodo TEXT,
            criado_em TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS indices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campeonato TEXT NOT NULL,
            categoria TEXT NOT NULL,
            piscina INTEGER NOT NULL,
            prova TEXT NOT NULL,
            tempo TEXT,
            tempo_segundos REAL,
            fonte TEXT,
            temporada TEXT DEFAULT '2025'
        );
        """)

def seed_data():
    with get_db() as conn:
        if conn.execute("SELECT COUNT(*) FROM atletas").fetchone()[0] > 0:
            return

        conn.execute("INSERT INTO atletas (nome,nome_completo,cor,cor_clara) VALUES (?,?,?,?)",
            ("Atleta 1","Atleta 1","#2e75b6","#bdd7ee"))
        conn.execute("INSERT INTO atletas (nome,nome_completo,cor,cor_clara) VALUES (?,?,?,?)",
            ("Clara Sereia","Clara Sereia Martes Freitas","#7b52ab","#e2d9f3"))

        resultados = [
            # ── Atleta 1 ──────────────────────────────────────────────
            (1,"2022-04-09","Livre 50m","00:58.13",50,"","","11°"),
            (1,"2022-05-01","Livre 50m","00:55.57",50,"","","6°"),
            (1,"2023-10-01","Livre 50m","00:41.89",50,"","","51°"),
            (1,"2023-12-03","Livre 50m","00:39.99",50,"","","19°"),
            (1,"2024-03-16","Livre 50m","00:39.07",50,"P1","AESJ","5°"),
            (1,"2024-04-27","Livre 50m","00:37.12",25,"P1","","10°"),
            (1,"2024-04-11","Livre 50m","00:37.53",25,"","",""),
            (1,"2024-05-18","Livre 50m","00:37.78",25,"","","9° manhã"),
            (1,"2024-08-24","Livre 50m","00:36.17",25,"","AESJ","5° manhã"),
            (1,"2024-09-21","Livre 50m","00:35.88",50,"","Guara EEA","10° manhã"),
            (1,"2024-09-28","Livre 50m","00:35.71",50,"","Unisanta","5° manhã"),
            (1,"2024-11-30","Livre 50m","00:34.29",50,"","","manhã REV"),
            (1,"2025-08-23","Livre 50m","00:33.80",25,"P2","AESJ","manhã"),
            (1,"2024-03-16","Livre 100m","01:30.01",50,"","","14°"),
            (1,"2024-04-27","Livre 100m","01:23.01",25,"","","9°"),
            (1,"2024-08-24","Livre 100m","01:20.16",25,"","","3° 🥉"),
            (1,"2024-09-28","Livre 100m","01:20.36",50,"","Unisanta","8° tarde"),
            (1,"2024-11-30","Livre 100m","01:18.24",50,"P1","Paulista Bauru","manhã"),
            (1,"2025-03-15","Livre 100m","01:17.78",50,"P2","AESJ","manhã"),
            (1,"2025-10-04","Livre 200m","02:47.35",25,"P2","Pinda","manhã"),
            (1,"2024-05-18","Livre 400m","06:38.99",25,"","",""),
            (1,"2024-06-21","Livre 400m","06:00.81",25,"","Americana","23°"),
            (1,"2024-09-21","Livre 400m","06:03.00",50,"","Guara EEA","5°"),
            (1,"2024-09-28","Livre 400m","05:54.84",50,"","Unisanta","4° tarde"),
            (1,"2024-11-02","Livre 400m","06:06.67",50,"","C. Olímpico SP","tarde"),
            (1,"2024-11-29","Livre 400m","05:50.27",50,"","Paulista Bauru","tarde"),
            (1,"2025-04-26","Livre 400m","05:41.21",25,"","Itaguara","6° manhã"),
            (1,"2025-05-23","Livre 400m","05:48.95",25,"P2","Sudeste","tarde"),
            (1,"2025-06-29","Livre 400m","05:51.53",25,"P2","Americana","tarde"),
            (1,"2025-10-04","Livre 400m","05:44.33",25,"P2","Pinda","manhã"),
            (1,"2025-10-25","Livre 400m","05:39.00",25,"P2","AESJ","manhã"),
            (1,"2025-03-15","Livre 800m","12:17.73",50,"P2","AESJ","noite"),
            (1,"2025-04-26","Livre 800m","11:50.10",25,"P2","Itaguara","manhã"),
            (1,"2025-05-10","Livre 800m","12:16.03",25,"P2","Pinda","manhã"),
            (1,"2025-08-23","Livre 800m","11:52.20",25,"P2","AESJ","tarde"),
            (1,"2025-11-20","Livre 800m","11:27.01",50,"P2","ABDA","manhã"),
            (1,"2026-03-14","Livre 800m","11:50.76",50,"INF","EEA Guara","manhã"),
            (1,"2022-04-09","Costas 50m","01:02.84",50,"","","5°"),
            (1,"2022-05-01","Costas 50m","01:06.22",50,"","","8°"),
            (1,"2023-10-07","Costas 50m","00:52.29",50,"","","15°"),
            (1,"2023-10-28","Costas 50m","00:50.73",50,"","","52°"),
            (1,"2023-12-03","Costas 50m","00:48.58",50,"","","6°"),
            (1,"2024-12-01","Costas 50m","00:40.41",50,"P1","Paulista","rev"),
            (1,"2025-05-24","Costas 50m","00:40.65",25,"P2","Sudeste",""),
            (1,"2026-03-14","Costas 50m","00:38.93",50,"INF","EEA Guara",""),
            (1,"2026-04-11","Costas 50m","00:38.44",50,"INF","Sta Rita",""),
            (1,"2024-04-27","Costas 100m","01:27.50",25,"P1","",""),
            (1,"2025-03-15","Costas 100m","01:31.29",50,"P2","AESJ","tarde"),
            (1,"2025-04-26","Costas 100m","01:28.42",25,"P2","Itaguará","tarde"),
            (1,"2025-05-24","Costas 100m","01:25.02",25,"P2","Sudeste","tarde"),
            (1,"2025-05-20","Costas 100m","01:29.39",50,"P2","Guara","manhã"),
            (1,"2025-10-25","Costas 100m","01:27.00",50,"P2","AESJ","manhã"),
            (1,"2025-11-20","Costas 100m","01:24.76",50,"P2","ABDA","tarde"),
            (1,"2026-04-11","Costas 100m","01:23.10",50,"INF","Sta Rita","manhã"),
            (1,"2025-05-10","Costas 200m","03:03.37",25,"P2","Pinda","4°"),
            (1,"2025-06-07","Costas 200m","03:00.80",25,"P2","AESJ","3° 🥉"),
            (1,"2025-06-28","Costas 200m","02:59.15",25,"P2","Americana","tarde"),
            (1,"2025-08-23","Costas 200m","02:59.10",25,"P2","AESJ","🥇"),
            (1,"2025-10-04","Costas 200m","03:00.76",25,"P2","Pinda","manhã"),
            (1,"2025-10-25","Costas 200m","03:07.84",25,"P2","AESJ","🥇"),
            (1,"2025-11-20","Costas 200m","02:58.34",50,"P2","ABDA","tarde"),
            (1,"2022-04-09","Peito 50m","01:17.92",50,"","","7°"),
            (1,"2023-10-01","Peito 50m","01:03.79",50,"","","85°"),
            (1,"2025-05-10","Peito 100m","01:35.08",25,"P2","Pinda","3° 🥉"),
            (1,"2025-05-20","Peito 100m","01:40.69",50,"P2","Guara","manhã"),
            (1,"2025-05-07","Peito 200m","03:27.90",25,"P2","AESJ","4°"),
            (1,"2023-10-07","Medley 100m","01:48.61",50,"","","11°"),
            (1,"2023-10-28","Medley 100m","01:48.37",50,"","","48°"),
            (1,"2024-04-27","Medley 100m","01:35.41",25,"","","5°"),
            (1,"2024-05-11","Medley 100m","01:35.80",25,"","","21°"),
            (1,"2024-05-18","Medley 100m","01:34.96",25,"","",""),
            (1,"2024-06-22","Medley 100m","01:30.20",25,"","Americana","26°"),
            (1,"2025-05-24","Medley 100m","01:26.38",25,"P2","Sudeste",""),
            (1,"2024-03-16","Medley 200m","03:47.45",50,"","","2° 🥈"),
            (1,"2024-08-24","Medley 200m","03:14.83",25,"","","3° 🥉"),
            (1,"2024-09-21","Medley 200m","03:23.94",50,"","Guara","5°"),
            (1,"2024-11-02","Medley 200m","03:16.03",50,"","C. Olímpico SP","tarde"),
            (1,"2024-11-30","Medley 200m","03:10.16",50,"P1","Paulista Bauru","manhã"),
            (1,"2025-03-15","Medley 200m","03:13.81",50,"P2","AESJ","manhã"),
            (1,"2025-05-10","Medley 200m","03:07.29",25,"P2","Pinda","🥈"),
            (1,"2025-05-23","Medley 200m","03:01.27",25,"P2","Sudeste","manhã"),
            (1,"2025-05-07","Medley 200m","03:04.25",25,"P2","AESJ","tarde"),
            (1,"2025-06-29","Medley 200m","03:05.90",25,"P2","Americana","manhã"),
            (1,"2025-08-23","Medley 200m","03:10.23",25,"P2","AESJ","🥉"),
            (1,"2025-05-20","Medley 200m","03:09.33",50,"P2","Guara","manhã"),
            (1,"2025-10-25","Medley 200m","03:03.70",50,"P2","AESJ","🥈"),
            (1,"2025-11-22","Medley 200m","02:56.42",50,"P2","ABDA","tarde"),
            (1,"2026-04-11","Medley 200m","02:55.67",50,"INF","Sta Rita","tarde"),
            (1,"2026-04-11","Medley 400m","06:13.88",50,"INF","Sta Rita","tarde"),
            # ── Clara Sereia ───────────────────────────────────────────
            (2,"2023-09-02","Peito 50m","01:10.31",50,"","","12°"),
            (2,"2023-10-01","Peito 50m","01:12.22",50,"","","68°"),
            (2,"2024-04-14","Peito 50m","01:00.66",50,"","","55°"),
            (2,"2024-04-25","Peito 50m","00:58.75",25,"","","16°"),
            (2,"2024-04-26","Peito 50m","00:59.85",50,"","Corinthians",""),
            (2,"2024-09-21","Peito 50m","00:58.01",25,"","Osasco","71°"),
            (2,"2024-11-30","Peito 50m","00:53.83",25,"","Parque do Sol","manhã"),
            (2,"2025-03-15","Peito 100m","01:59.30",50,"P1","AESJ","10° tarde"),
            (2,"2025-04-26","Peito 100m","01:49.04",25,"P1","Itaguara","15° manhã"),
            (2,"2025-05-24","Peito 100m","01:49.88",25,"P1","Sudeste","manhã"),
            (2,"2025-05-20","Peito 100m","01:52.06",50,"P1","Guaratinguetá","manhã"),
            (2,"2025-10-04","Peito 100m","01:47.03",25,"P1","Pinda","desclassificada"),
            (2,"2025-10-25","Peito 100m","01:46.44",50,"P1","AESJ","manhã"),
            (2,"2025-11-21","Peito 100m","01:43.86",50,"P1","ABDA","manhã"),
            (2,"2026-03-14","Peito 100m","01:43.94",50,"P2","EEA Guara","manhã"),
            (2,"2026-04-11","Peito 100m","01:43.56",50,"P2","Sta Rita","tarde"),
            (2,"2023-09-02","Livre 50m","00:59.13",50,"","","19°"),
            (2,"2023-10-01","Livre 50m","00:55.30",50,"","","67°"),
            (2,"2023-12-03","Livre 50m","00:52.13",50,"","","28°"),
            (2,"2024-04-13","Livre 50m","00:45.00",50,"","","17°"),
            (2,"2024-04-14","Livre 50m","00:44.74",25,"","","55°"),
            (2,"2024-04-25","Livre 50m","00:45.57",25,"","Pinda","17°"),
            (2,"2024-04-26","Livre 50m","00:47.50",50,"","Corinthians",""),
            (2,"2024-06-08","Livre 50m","00:46.17",25,"","Corinthians","15°"),
            (2,"2024-06-15","Livre 50m","00:42.52",25,"","Caraguá","18°"),
            (2,"2024-09-14","Livre 50m","00:40.26",25,"","São Sebastião","16°"),
            (2,"2024-09-21","Livre 50m","00:40.42",25,"","Osasco","50°"),
            (2,"2024-10-26","Livre 50m","00:42.59",50,"","Corinthians","16°"),
            (2,"2024-11-30","Livre 50m","00:40.06",25,"","Parque do Sol","manhã"),
            (2,"2025-05-10","Livre 50m","00:39.31",25,"P2","Pinda","tarde"),
            (2,"2025-05-24","Livre 50m","00:38.84",25,"P2","Sudeste","tarde"),
            (2,"2025-08-23","Livre 50m","00:36.29",25,"P1","AESJ","manhã"),
            (2,"2025-10-04","Livre 50m","00:38.12",25,"P1","Pinda","manhã"),
            (2,"2025-10-25","Livre 50m","00:37.07",50,"P1","AESJ","manhã"),
            (2,"2025-11-20","Livre 50m","00:36.64",50,"P1","ABDA","manhã"),
            (2,"2026-03-14","Livre 50m","00:35.76",50,"P2","EEA Guara","manhã"),
            (2,"2026-04-11","Livre 50m","00:34.28",50,"P2","Sta Rita","manhã"),
            (2,"2024-04-13","Livre 100m","01:48.04",50,"","","17°"),
            (2,"2024-06-15","Livre 100m","01:42.71",25,"","Caraguá","19°"),
            (2,"2024-09-14","Livre 100m","01:40.06",25,"","São Sebastião","16°"),
            (2,"2025-04-26","Livre 100m","01:28.28",25,"P1","Itaguara","18° manhã"),
            (2,"2025-04-26","Livre 100m","01:30.24",25,"P1","Sudeste",""),
            (2,"2025-08-23","Livre 100m","01:25.66",25,"P1","AESJ",""),
            (2,"2025-05-20","Livre 100m","01:27.45",50,"P1","Guara","manhã"),
            (2,"2025-11-21","Livre 100m","01:23.32",50,"P1","ABDA","manhã"),
            (2,"2026-03-14","Livre 100m","01:17.20",50,"P2","EEA Guara","manhã"),
            (2,"2026-04-11","Livre 100m","01:18.64",50,"P2","Sta Rita","tarde"),
            (2,"2024-11-30","Livre 200m","03:40.00",25,"","Parque do Sol","manhã"),
            (2,"2025-05-10","Livre 200m","03:21.17",25,"P1","Pinda",""),
            (2,"2024-06-08","Borboleta 50m","00:52.66",25,"","Corinthians","48°"),
            (2,"2024-06-15","Borboleta 50m","00:56.67",25,"","Caraguá",""),
            (2,"2024-10-26","Borboleta 50m","00:49.81",50,"","Corinthians","4°"),
            (2,"2024-11-24","Borboleta 50m","00:53.52",25,"","Timão","manhã"),
            (2,"2025-05-23","Borboleta 50m","00:43.86",25,"P1","Sudeste",""),
            (2,"2025-03-15","Borboleta 100m","01:49.94",50,"P1","AESJ","5° manhã"),
            (2,"2025-05-23","Borboleta 100m","01:45.96",25,"P1","Sudeste","noite"),
            (2,"2025-06-28","Borboleta 100m","01:37.14",25,"P1","Americana","noite"),
            (2,"2025-08-23","Borboleta 100m","01:39.83",25,"P1","AESJ","manhã"),
            (2,"2025-10-25","Borboleta 100m","01:38.08",25,"P1","AESJ","🥉 manhã"),
            (2,"2026-04-11","Borboleta 100m","01:32.02",50,"P2","Sta Rita","manhã"),
            (2,"2023-10-07","Medley 100m","02:12.51",50,"","","13°"),
            (2,"2023-10-28","Medley 100m","02:19.22",50,"","","60°"),
            (2,"2024-05-04","Medley 100m","01:54.52",50,"","","50°"),
            (2,"2024-04-25","Medley 100m","01:55.05",25,"","","12°"),
            (2,"2024-11-03","Medley 100m","01:47.78",25,"","Speria",""),
            (2,"2025-04-24","Medley 100m","01:38.34",25,"P1","Itaguará","14° manhã"),
            (2,"2025-06-29","Medley 100m","01:31.13",25,"P1","Americana","manhã"),
            (2,"2023-10-07","Costas 50m","01:00.53",50,"","","17°"),
            (2,"2023-10-28","Costas 50m","01:01.30",50,"","","63°"),
            (2,"2023-12-03","Costas 50m","01:03.95",50,"","","14°"),
            (2,"2024-04-13","Costas 50m","00:52.17",50,"","","13°"),
            (2,"2024-05-04","Costas 50m","00:51.30",50,"","","51°"),
            (2,"2024-09-14","Costas 50m","00:53.87",25,"","São Sebastião","17°"),
            (2,"2025-05-24","Costas 50m","00:44.86",25,"P1","Sudeste",""),
            (2,"2025-03-15","Costas 100m","01:42.90",50,"P1","AESJ","6° tarde"),
            (2,"2025-05-07","Costas 100m","01:42.50",25,"P1","AESJ","tarde"),
        ]

        for aid, d, prova, tempo, pisc, cat, ev, obs in resultados:
            conn.execute(
                "INSERT INTO resultados (atleta_id,data,prova,tempo,tempo_segundos,piscina,categoria,evento,obs) VALUES (?,?,?,?,?,?,?,?,?)",
                (aid, d, prova, tempo, ts(tempo), pisc, cat, ev, obs)
            )

        indices = [
            # ── FAP Petiz 1 (11 anos) - Oficial Verão 2026 ─────────
            ("FAP Paulista Petiz","Petiz 1",25,"Livre 50m","00:37.30"),
            ("FAP Paulista Petiz","Petiz 1",25,"Livre 100m","01:26.20"),
            ("FAP Paulista Petiz","Petiz 1",25,"Livre 200m","03:02.20"),
            ("FAP Paulista Petiz","Petiz 1",25,"Livre 400m","06:14.20"),
            ("FAP Paulista Petiz","Petiz 1",25,"Costas 100m","01:40.90"),
            ("FAP Paulista Petiz","Petiz 1",25,"Peito 100m","01:50.70"),
            ("FAP Paulista Petiz","Petiz 1",25,"Borboleta 100m","01:49.80"),
            ("FAP Paulista Petiz","Petiz 1",25,"Medley 200m","03:17.90"),
            ("FAP Paulista Petiz","Petiz 1",50,"Livre 50m","00:38.30"),
            ("FAP Paulista Petiz","Petiz 1",50,"Livre 100m","01:28.20"),
            ("FAP Paulista Petiz","Petiz 1",50,"Livre 200m","03:06.20"),
            ("FAP Paulista Petiz","Petiz 1",50,"Livre 400m","06:22.20"),
            ("FAP Paulista Petiz","Petiz 1",50,"Costas 100m","01:42.90"),
            ("FAP Paulista Petiz","Petiz 1",50,"Peito 100m","01:52.70"),
            ("FAP Paulista Petiz","Petiz 1",50,"Borboleta 100m","01:51.80"),
            ("FAP Paulista Petiz","Petiz 1",50,"Medley 200m","03:21.90"),
            # ── FAP Petiz 2 (12 anos) - Oficial Verão 2026 ─────────
            ("FAP Paulista Petiz","Petiz 2",25,"Livre 50m","00:34.80"),
            ("FAP Paulista Petiz","Petiz 2",25,"Livre 100m","01:18.40"),
            ("FAP Paulista Petiz","Petiz 2",25,"Livre 200m","02:49.50"),
            ("FAP Paulista Petiz","Petiz 2",25,"Livre 400m","05:45.80"),
            ("FAP Paulista Petiz","Petiz 2",25,"Livre 800m","11:41.40"),
            ("FAP Paulista Petiz","Petiz 2",25,"Costas 100m","01:32.10"),
            ("FAP Paulista Petiz","Petiz 2",25,"Costas 200m","03:06.20"),
            ("FAP Paulista Petiz","Petiz 2",25,"Peito 100m","01:42.90"),
            ("FAP Paulista Petiz","Petiz 2",25,"Peito 200m","03:25.80"),
            ("FAP Paulista Petiz","Petiz 2",25,"Borboleta 100m","01:35.10"),
            ("FAP Paulista Petiz","Petiz 2",25,"Borboleta 200m","03:16.00"),
            ("FAP Paulista Petiz","Petiz 2",25,"Medley 200m","03:06.20"),
            ("FAP Paulista Petiz","Petiz 2",50,"Livre 50m","00:35.80"),
            ("FAP Paulista Petiz","Petiz 2",50,"Livre 100m","01:20.40"),
            ("FAP Paulista Petiz","Petiz 2",50,"Livre 200m","02:53.50"),
            ("FAP Paulista Petiz","Petiz 2",50,"Livre 400m","05:53.80"),
            ("FAP Paulista Petiz","Petiz 2",50,"Livre 800m","11:57.40"),
            ("FAP Paulista Petiz","Petiz 2",50,"Costas 100m","01:34.10"),
            ("FAP Paulista Petiz","Petiz 2",50,"Costas 200m","03:10.20"),
            ("FAP Paulista Petiz","Petiz 2",50,"Peito 100m","01:44.90"),
            ("FAP Paulista Petiz","Petiz 2",50,"Peito 200m","03:29.80"),
            ("FAP Paulista Petiz","Petiz 2",50,"Borboleta 100m","01:37.10"),
            ("FAP Paulista Petiz","Petiz 2",50,"Borboleta 200m","03:20.00"),
            ("FAP Paulista Petiz","Petiz 2",50,"Medley 200m","03:10.20"),
            ("FAP Paulista Infantil","Infantil",50,"Livre 50m","00:32.00"),
            ("FAP Paulista Infantil","Infantil",50,"Livre 100m","01:11.00"),
            ("FAP Paulista Infantil","Infantil",50,"Livre 200m","02:34.00"),
            ("FAP Paulista Infantil","Infantil",50,"Livre 400m","05:25.00"),
            ("FAP Paulista Infantil","Infantil",50,"Livre 800m","11:20.00"),
            ("FAP Paulista Infantil","Infantil",50,"Costas 50m","00:37.50"),
            ("FAP Paulista Infantil","Infantil",50,"Costas 100m","01:21.00"),
            ("FAP Paulista Infantil","Infantil",50,"Costas 200m","02:55.00"),
            ("FAP Paulista Infantil","Infantil",50,"Peito 50m","00:44.00"),
            ("FAP Paulista Infantil","Infantil",50,"Peito 100m","01:38.00"),
            ("FAP Paulista Infantil","Infantil",50,"Borboleta 50m","00:37.00"),
            ("FAP Paulista Infantil","Infantil",50,"Borboleta 100m","01:25.00"),
            ("FAP Paulista Infantil","Infantil",50,"Medley 100m","01:20.00"),
            ("FAP Paulista Infantil","Infantil",50,"Medley 200m","02:52.00"),
            ("FAP Paulista Infantil","Infantil",50,"Medley 400m","06:10.00"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Livre 50m","00:31.60"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Livre 100m","01:09.04"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Livre 200m","02:30.86"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Livre 400m","05:15.74"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Livre 800m","10:52.56"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Costas 100m","01:21.52"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Costas 200m","02:55.03"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Peito 100m","01:30.99"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Peito 200m","03:17.16"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Borboleta 100m","01:18.72"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Medley 200m","02:52.62"),
            ("CBDA Brasileiro Infantil","Infantil 1",50,"Medley 400m","06:07.74"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Livre 50m","00:30.93"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Livre 100m","01:07.58"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Livre 200m","02:27.65"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Livre 400m","05:09.02"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Livre 800m","10:38.35"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Costas 100m","01:19.45"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Costas 200m","02:50.59"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Peito 100m","01:28.69"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Peito 200m","03:12.17"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Borboleta 100m","01:16.73"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Medley 200m","02:48.67"),
            ("CBDA Brasileiro Infantil","Infantil 2",50,"Medley 400m","05:59.12"),
        ]

        for camp, cat, pisc, prova, tempo in indices:
            conn.execute(
                "INSERT INTO indices (campeonato,categoria,piscina,prova,tempo,tempo_segundos,fonte,temporada) VALUES (?,?,?,?,?,?,?,?)",
                (camp, cat, pisc, prova, tempo, ts(tempo), "FAP/CBDA 2025", "2025")
            )

# ── Rotas ──────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/atletas")
def api_atletas():
    with get_db() as conn:
        return jsonify([dict(r) for r in conn.execute("SELECT * FROM atletas ORDER BY id").fetchall()])

@app.route("/api/atletas", methods=["POST"])
def add_atleta():
    d = request.json
    with get_db() as conn:
        conn.execute("INSERT INTO atletas (nome,nome_completo,cor,cor_clara) VALUES (?,?,?,?)",
            (d["nome"], d.get("nome_completo",""), d.get("cor","#2e75b6"), d.get("cor_clara","#bdd7ee")))
        nid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        return jsonify(dict(conn.execute("SELECT * FROM atletas WHERE id=?", (nid,)).fetchone())), 201

@app.route("/api/atletas/<int:aid>", methods=["PUT"])
def upd_atleta(aid):
    d = request.json
    with get_db() as conn:
        conn.execute("UPDATE atletas SET nome=?,nome_completo=? WHERE id=?",
            (d["nome"], d.get("nome_completo",""), aid))
        return jsonify(dict(conn.execute("SELECT * FROM atletas WHERE id=?", (aid,)).fetchone()))

@app.route("/api/resultados/<int:atleta_id>")
def api_resultados(atleta_id):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM resultados WHERE atleta_id=? ORDER BY data ASC", (atleta_id,)).fetchall()
        return jsonify([dict(r) for r in rows])

@app.route("/api/resultados", methods=["POST"])
def add_resultado():
    d = request.json
    with get_db() as conn:
        conn.execute(
            "INSERT INTO resultados (atleta_id,data,prova,tempo,tempo_segundos,piscina,categoria,evento,obs,periodo) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (d["atleta_id"], d["data"], d["prova"], d.get("tempo"), ts(d.get("tempo")),
             d.get("piscina"), d.get("categoria"), d.get("evento"), d.get("obs"), d.get("periodo")))
        nid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        return jsonify(dict(conn.execute("SELECT * FROM resultados WHERE id=?", (nid,)).fetchone())), 201

@app.route("/api/resultados/<int:rid>", methods=["PUT"])
def upd_resultado(rid):
    d = request.json
    with get_db() as conn:
        conn.execute(
            "UPDATE resultados SET data=?,prova=?,tempo=?,tempo_segundos=?,piscina=?,categoria=?,evento=?,obs=?,periodo=? WHERE id=?",
            (d["data"], d["prova"], d.get("tempo"), ts(d.get("tempo")),
             d.get("piscina"), d.get("categoria"), d.get("evento"), d.get("obs"), d.get("periodo"), rid))
        return jsonify(dict(conn.execute("SELECT * FROM resultados WHERE id=?", (rid,)).fetchone()))

@app.route("/api/resultados/<int:rid>", methods=["DELETE"])
def del_resultado(rid):
    with get_db() as conn:
        conn.execute("DELETE FROM resultados WHERE id=?", (rid,))
        return jsonify({"ok": True})

@app.route("/api/indices")
def api_indices():
    with get_db() as conn:
        return jsonify([dict(r) for r in conn.execute("SELECT * FROM indices ORDER BY campeonato,prova").fetchall()])

@app.route("/api/indices/<int:iid>", methods=["PUT"])
def upd_indice(iid):
    d = request.json
    with get_db() as conn:
        conn.execute("UPDATE indices SET tempo=?,tempo_segundos=? WHERE id=?",
            (d.get("tempo"), ts(d.get("tempo")), iid))
        return jsonify(dict(conn.execute("SELECT * FROM indices WHERE id=?", (iid,)).fetchone()))

# ── Competições ─────────────────────────────────────────────────────────────
def init_competicoes():
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS competicoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            local TEXT,
            data_inicio TEXT NOT NULL,
            data_fim TEXT,
            categoria TEXT,
            piscina INTEGER DEFAULT 25,
            status TEXT DEFAULT 'planejado',
            obs TEXT,
            criado_em TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS competicao_atletas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            competicao_id INTEGER NOT NULL,
            atleta_id INTEGER NOT NULL,
            FOREIGN KEY (competicao_id) REFERENCES competicoes(id),
            FOREIGN KEY (atleta_id) REFERENCES atletas(id)
        );
        CREATE TABLE IF NOT EXISTS competicao_provas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            competicao_id INTEGER NOT NULL,
            atleta_id INTEGER NOT NULL,
            prova TEXT NOT NULL,
            horario TEXT,
            status TEXT DEFAULT 'a_definir',
            obs TEXT,
            -- campos de balizamento
            num_prova INTEGER,
            etapa TEXT,
            serie INTEGER,
            raia INTEGER,
            tempo_inscricao TEXT,
            tempo_final TEXT,
            colocacao TEXT,
            FOREIGN KEY (competicao_id) REFERENCES competicoes(id),
            FOREIGN KEY (atleta_id) REFERENCES atletas(id)
        );
        CREATE TABLE IF NOT EXISTS nutricao_plano (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            tipo TEXT DEFAULT 'base',
            atleta_id INTEGER,
            momento TEXT,
            descricao TEXT,
            competicao_id INTEGER,
            criado_em TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS nutricao_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plano_id INTEGER NOT NULL,
            horario TEXT,
            item TEXT NOT NULL,
            quantidade TEXT,
            obs TEXT,
            FOREIGN KEY (plano_id) REFERENCES nutricao_plano(id)
        );
        """)
    # Migração: adicionar colunas de balizamento se banco já existia
    with get_db() as conn:
        # Migrar competicoes
        cols_c = [r[1] for r in conn.execute("PRAGMA table_info(competicoes)").fetchall()]
        if "piscina" not in cols_c:
            conn.execute("ALTER TABLE competicoes ADD COLUMN piscina INTEGER DEFAULT 25")
        # Migrar competicao_provas
        cols = [r[1] for r in conn.execute("PRAGMA table_info(competicao_provas)").fetchall()]
        for col, typ in [("num_prova","INTEGER"),("etapa","TEXT"),("serie","INTEGER"),
                         ("raia","INTEGER"),("tempo_inscricao","TEXT"),
                         ("tempo_final","TEXT"),("colocacao","TEXT"),("horario_prova","TEXT"),
                         ("data_prova","TEXT")]:
            if col not in cols:
                conn.execute(f"ALTER TABLE competicao_provas ADD COLUMN {col} {typ}")

        # Migração: coluna 'periodo' em resultados (Manhã/Tarde/Noite)
        cols_r = [r[1] for r in conn.execute("PRAGMA table_info(resultados)").fetchall()]
        if "periodo" not in cols_r:
            conn.execute("ALTER TABLE resultados ADD COLUMN periodo TEXT")
        # Auto-extrai período da coluna 'obs' para registros que ainda não tenham 'periodo'
        # (mantém o texto original em obs — política "copiar, não mover")
        import re as _re
        registros = conn.execute(
            "SELECT id, obs FROM resultados WHERE (periodo IS NULL OR periodo='') AND obs IS NOT NULL AND obs != ''"
        ).fetchall()
        for r in registros:
            obs_lower = (r["obs"] or "").lower()
            periodo = None
            # ordem importa: 'noite' antes de 'tarde' (não há colisão, mas explicito)
            if _re.search(r"\bmanh[ãa]\b", obs_lower):
                periodo = "Manhã"
            elif _re.search(r"\btarde\b", obs_lower):
                periodo = "Tarde"
            elif _re.search(r"\bnoite\b", obs_lower):
                periodo = "Noite"
            if periodo:
                conn.execute("UPDATE resultados SET periodo=? WHERE id=?", (periodo, r["id"]))

def seed_competicoes():
    """Insere o 3º Torneio Regional FAP e provas da Maitê se ainda não existirem."""
    with get_db() as conn:
        existe = conn.execute(
            "SELECT id FROM competicoes WHERE nome LIKE '%3%Torneio Regional FAP%'").fetchone()
        if existe:
            return
        conn.execute(
            "INSERT INTO competicoes (nome,local,data_inicio,data_fim,categoria,status,obs) VALUES (?,?,?,?,?,?,?)",
            ("3º Torneio Regional FAP - 6ª Região",
             "Itaguara Country Clube - Guaratinguetá",
             "2026-04-25", "2026-04-25",
             "Infantil", "confirmado",
             "Piscina 25m, 8 raias. Balizamento FAP."))
        cid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        aid = 1  # Maitê = atleta_id 1
        conn.execute("INSERT OR IGNORE INTO competicao_atletas (competicao_id,atleta_id) VALUES (?,?)", (cid, aid))
        provas = [
            ("Medley 400m", "1ª Etapa", 1,  1, 7, ""),
            ("Livre 50m",   "1ª Etapa", 17, 10, 7, "00:33.92"),
            ("Costas 50m",  "2ª Etapa", 23, 2,  6, "00:40.65"),
            ("Costas 200m", "2ª Etapa", 31, 3,  1, "02:59.10"),
        ]
        for prova, etapa, num, serie, raia, t_insc in provas:
            conn.execute(
                """INSERT INTO competicao_provas
                   (competicao_id,atleta_id,prova,etapa,num_prova,serie,raia,tempo_inscricao,status)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (cid, aid, prova, etapa, num, serie, raia, t_insc, "confirmada"))

@app.route("/api/competicoes")
def get_competicoes():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM competicoes ORDER BY data_inicio ASC").fetchall()
        result = []
        for r in rows:
            c = dict(r)
            atletas_ids = [x[0] for x in conn.execute(
                "SELECT atleta_id FROM competicao_atletas WHERE competicao_id=?", (c["id"],)).fetchall()]
            c["atletas"] = atletas_ids
            result.append(c)
        return jsonify(result)

@app.route("/api/competicoes", methods=["POST"])
def add_competicao():
    d = request.json
    with get_db() as conn:
        conn.execute(
            "INSERT INTO competicoes (nome,local,data_inicio,data_fim,categoria,piscina,status,obs) VALUES (?,?,?,?,?,?,?,?)",
            (d["nome"], d.get("local",""), d["data_inicio"], d.get("data_fim",""),
             d.get("categoria",""), d.get("piscina",25), d.get("status","planejado"), d.get("obs","")))
        nid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        for aid in d.get("atletas", []):
            conn.execute("INSERT INTO competicao_atletas (competicao_id,atleta_id) VALUES (?,?)", (nid, aid))
        row = conn.execute("SELECT * FROM competicoes WHERE id=?", (nid,)).fetchone()
        return jsonify(dict(row)), 201

@app.route("/api/competicoes/<int:cid>", methods=["PUT"])
def upd_competicao(cid):
    d = request.json
    with get_db() as conn:
        conn.execute(
            "UPDATE competicoes SET nome=?,local=?,data_inicio=?,data_fim=?,categoria=?,piscina=?,status=?,obs=? WHERE id=?",
            (d["nome"], d.get("local",""), d["data_inicio"], d.get("data_fim",""),
             d.get("categoria",""), d.get("piscina",25), d.get("status","planejado"), d.get("obs",""), cid))
        conn.execute("DELETE FROM competicao_atletas WHERE competicao_id=?", (cid,))
        for aid in d.get("atletas", []):
            conn.execute("INSERT INTO competicao_atletas (competicao_id,atleta_id) VALUES (?,?)", (cid, aid))
        return jsonify(dict(conn.execute("SELECT * FROM competicoes WHERE id=?", (cid,)).fetchone()))

@app.route("/api/competicoes/<int:cid>", methods=["DELETE"])
def del_competicao(cid):
    with get_db() as conn:
        conn.execute("DELETE FROM competicao_atletas WHERE competicao_id=?", (cid,))
        conn.execute("DELETE FROM competicao_provas WHERE competicao_id=?", (cid,))
        conn.execute("DELETE FROM competicoes WHERE id=?", (cid,))
        return jsonify({"ok": True})

@app.route("/api/competicoes/<int:cid>/provas")
def get_provas_comp(cid):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM competicao_provas WHERE competicao_id=? ORDER BY data_prova ASC, horario ASC, atleta_id ASC", (cid,)).fetchall()
        return jsonify([dict(r) for r in rows])

@app.route("/api/competicoes/<int:cid>/provas", methods=["POST"])
def add_prova_comp(cid):
    d = request.json
    with get_db() as conn:
        conn.execute(
            """INSERT INTO competicao_provas
               (competicao_id,atleta_id,prova,horario,status,obs,
                num_prova,etapa,serie,raia,tempo_inscricao,tempo_final,colocacao,horario_prova,data_prova)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, d["atleta_id"], d["prova"], d.get("horario",""), d.get("status","a_definir"), d.get("obs",""),
             d.get("num_prova"), d.get("etapa",""), d.get("serie"), d.get("raia"),
             d.get("tempo_inscricao",""), d.get("tempo_final",""), d.get("colocacao",""),
             d.get("horario_prova",""), d.get("data_prova","")))
        nid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        return jsonify(dict(conn.execute("SELECT * FROM competicao_provas WHERE id=?", (nid,)).fetchone())), 201

@app.route("/api/provas/<int:pid>", methods=["PUT"])
def upd_prova(pid):
    d = request.json
    with get_db() as conn:
        conn.execute(
            """UPDATE competicao_provas SET
               prova=?,horario=?,horario_prova=?,status=?,obs=?,
               num_prova=?,etapa=?,serie=?,raia=?,
               tempo_inscricao=?,tempo_final=?,colocacao=?,data_prova=?
               WHERE id=?""",
            (d["prova"], d.get("horario",""), d.get("horario_prova", d.get("horario","")),
             d.get("status","a_definir"), d.get("obs",""),
             d.get("num_prova"), d.get("etapa",""), d.get("serie"), d.get("raia"),
             d.get("tempo_inscricao",""), d.get("tempo_final",""), d.get("colocacao",""),
             d.get("data_prova",""), pid))
        return jsonify(dict(conn.execute("SELECT * FROM competicao_provas WHERE id=?", (pid,)).fetchone()))

@app.route("/api/provas/<int:pid>", methods=["DELETE"])
def del_prova(pid):
    with get_db() as conn:
        conn.execute("DELETE FROM competicao_provas WHERE id=?", (pid,))
        return jsonify({"ok": True})

@app.route("/api/nutricao")
def get_nutricao():
    with get_db() as conn:
        planos = conn.execute("SELECT * FROM nutricao_plano ORDER BY tipo, momento").fetchall()
        result = []
        for p in planos:
            pl = dict(p)
            pl["items"] = [dict(i) for i in conn.execute(
                "SELECT * FROM nutricao_items WHERE plano_id=? ORDER BY horario", (pl["id"],)).fetchall()]
            result.append(pl)
        return jsonify(result)

@app.route("/api/nutricao", methods=["POST"])
def add_nutricao():
    d = request.json
    with get_db() as conn:
        conn.execute(
            "INSERT INTO nutricao_plano (titulo,tipo,atleta_id,momento,descricao,competicao_id) VALUES (?,?,?,?,?,?)",
            (d["titulo"], d.get("tipo","base"), d.get("atleta_id"), d.get("momento",""),
             d.get("descricao",""), d.get("competicao_id")))
        nid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        for item in d.get("items", []):
            conn.execute(
                "INSERT INTO nutricao_items (plano_id,horario,item,quantidade,obs) VALUES (?,?,?,?,?)",
                (nid, item.get("horario",""), item["item"], item.get("quantidade",""), item.get("obs","")))
        return jsonify({"id": nid}), 201

@app.route("/api/nutricao/<int:pid>", methods=["DELETE"])
def del_nutricao(pid):
    with get_db() as conn:
        conn.execute("DELETE FROM nutricao_items WHERE plano_id=?", (pid,))
        conn.execute("DELETE FROM nutricao_plano WHERE id=?", (pid,))
        return jsonify({"ok": True})


# ── Importação de PDF de torneio ────────────────────────────────────────────
# Estratégia: extrai texto com pdfplumber, depois aplica regex tolerante
# para detectar prova/horário/etapa/série/raia/tempo de inscrição.
# NÃO salva nada — devolve preview JSON pra você revisar antes de confirmar.

# Estilos de prova reconhecidos no PDF (com variações comuns de grafia)
_ESTILOS_PDF = [
    (r"livre",     "Livre"),
    (r"costas",    "Costas"),
    (r"peito",     "Peito"),
    (r"borboleta", "Borboleta"),
    (r"medley",    "Medley"),
]

def _normalizar_prova(texto):
    """'50m livre', '50 m LIVRE', 'Livre 50', '50M LIVRES' → 'Livre 50m'. None se não bater."""
    if not texto:
        return None
    t = texto.lower().strip()
    # acha distância (ex: 50, 100, 200, 400, 800, 1500)
    m_dist = re.search(r"\b(50|100|200|400|800|1500)\s*m?\b", t)
    if not m_dist:
        return None
    dist = m_dist.group(1)
    # acha estilo
    estilo = None
    for pat, nome in _ESTILOS_PDF:
        if re.search(pat, t):
            estilo = nome
            break
    if not estilo:
        return None
    return f"{estilo} {dist}m"

def _normalizar_horario(texto):
    """'14:30', '14h30', '02:45 PM' → 'HH:MM'. None se não bater.
    Aceita só faixa razoável de horário de prova: 05:00–23:59."""
    if not texto:
        return None
    # Procura padrão e exclui se vier seguido de ponto/vírgula+dígitos (= tempo de inscrição)
    for m in re.finditer(r"\b([01]?\d|2[0-3])\s*[:hH]\s*([0-5]\d)\b", texto):
        h = int(m.group(1))
        # Sufixo logo depois? Provavelmente é tempo (00:33.92)
        suf = texto[m.end():m.end()+4]
        if re.match(r"[.,]\d{2}", suf):
            continue
        # Faixa de horário de prova
        if 5 <= h <= 23:
            return f"{h:02d}:{m.group(2)}"
    return None

def _normalizar_tempo_inscricao(texto):
    """'01:17.78', '1:17,78', '00:33.92' → 'MM:SS.cc'. None se não bater."""
    if not texto:
        return None
    m = re.search(r"\b(\d{1,2})[:.,](\d{2})[.,](\d{2})\b", texto)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}.{m.group(3)}"
    return None

def parse_pdf_torneio(pdf_bytes):
    """Recebe bytes do PDF, devolve lista de dicts (uma linha = uma prova).
    Cada dict: {linha_pdf, prova, horario_prova, etapa, num_prova, serie, raia, tempo_inscricao, atleta_id (sempre None)}.

    Heurística tolerante:
    - Mantém estado de etapa atual (linhas tipo "1ª Etapa" pegam o restante).
    - Para cada linha que parece linha-de-prova (tem estilo+distância), captura
      número/série/raia/horário/etapa da própria linha.
    - Olha até 2 linhas seguintes procurando o tempo de inscrição (formato MM:SS.cc),
      que normalmente vem na linha do nome do atleta.
    """
    try:
        import pdfplumber
    except ImportError:
        return {"erro": "pdfplumber não instalado. Adicione 'pdfplumber' ao requirements.txt."}

    import io
    resultados = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            todas_linhas = []
            for pagina in pdf.pages:
                texto = pagina.extract_text() or ""
                for linha in texto.split("\n"):
                    s = linha.strip()
                    if s:
                        todas_linhas.append(s)

            etapa_atual = ""
            for i, linha_strip in enumerate(todas_linhas):
                # Marcador de etapa solto
                m_etapa = re.fullmatch(r"\s*(\d)\s*[ªa°]?\s*etapa\s*", linha_strip, re.IGNORECASE)
                if m_etapa:
                    etapa_atual = f"{m_etapa.group(1)}ª Etapa"
                    continue

                prova = _normalizar_prova(linha_strip)
                if not prova:
                    continue

                horario = _normalizar_horario(linha_strip)

                # Tempo de inscrição: tenta na linha atual e nas próximas 2
                tempo_insc = _normalizar_tempo_inscricao(linha_strip)
                linha_atleta_pdf = ""
                if not tempo_insc:
                    for j in range(1, 3):
                        if i + j < len(todas_linhas):
                            t = _normalizar_tempo_inscricao(todas_linhas[i + j])
                            if t:
                                tempo_insc = t
                                linha_atleta_pdf = todas_linhas[i + j]
                                break

                # nº prova
                num_prova = None
                m_np = re.search(r"prova\s*(\d{1,3})", linha_strip, re.IGNORECASE)
                if m_np:
                    num_prova = int(m_np.group(1))
                else:
                    m_np = re.match(r"^\s*(\d{1,3})\s*[\-–—]", linha_strip)
                    if m_np:
                        num_prova = int(m_np.group(1))

                # série / raia
                serie = None
                raia = None
                m_sr = re.search(r"s[ée]rie\s*(\d{1,2})", linha_strip, re.IGNORECASE)
                if m_sr: serie = int(m_sr.group(1))
                m_r = re.search(r"raia\s*([1-8])", linha_strip, re.IGNORECASE)
                if m_r: raia = int(m_r.group(1))

                # etapa na própria linha sobrescreve a atual
                m_e = re.search(r"(\d)\s*[ªa°]?\s*etapa", linha_strip, re.IGNORECASE)
                etapa = f"{m_e.group(1)}ª Etapa" if m_e else etapa_atual

                resultados.append({
                    "linha_pdf": (linha_strip + (" | " + linha_atleta_pdf if linha_atleta_pdf else ""))[:200],
                    "prova": prova,
                    "horario_prova": horario or "",
                    "etapa": etapa,
                    "num_prova": num_prova,
                    "serie": serie,
                    "raia": raia,
                    "tempo_inscricao": tempo_insc or "",
                    "atleta_id": None,
                })
    except Exception as e:
        return {"erro": f"Falha ao ler PDF: {type(e).__name__}: {e}"}

    return {"provas": resultados}


@app.route("/api/competicoes/<int:cid>/importar-pdf", methods=["POST"])
def importar_pdf_competicao(cid):
    """Recebe um PDF, devolve preview JSON. NÃO salva nada — só extrai."""
    if "arquivo" not in request.files:
        return jsonify({"erro": "Envie o PDF no campo 'arquivo' (multipart/form-data)."}), 400
    f = request.files["arquivo"]
    if not f.filename.lower().endswith(".pdf"):
        return jsonify({"erro": "Arquivo precisa ser .pdf"}), 400
    pdf_bytes = f.read()
    if len(pdf_bytes) > 10 * 1024 * 1024:  # 10 MB
        return jsonify({"erro": "PDF maior que 10 MB."}), 413

    resultado = parse_pdf_torneio(pdf_bytes)
    if "erro" in resultado:
        return jsonify(resultado), 422

    # Verifica que a competição existe (não modifica nada)
    with get_db() as conn:
        comp = conn.execute("SELECT id, nome FROM competicoes WHERE id=?", (cid,)).fetchone()
        if not comp:
            return jsonify({"erro": "Competição não encontrada."}), 404
        atletas = [dict(r) for r in conn.execute(
            "SELECT a.id, a.nome FROM atletas a "
            "JOIN competicao_atletas ca ON ca.atleta_id=a.id "
            "WHERE ca.competicao_id=? ORDER BY a.id", (cid,)).fetchall()]

    return jsonify({
        "competicao": {"id": comp["id"], "nome": comp["nome"]},
        "atletas_competicao": atletas,
        "total_provas_extraidas": len(resultado["provas"]),
        "provas": resultado["provas"],
    })


# ── Inicialização ───────────────────────────────────────────────────────────
# Roda tanto via `python app.py` quanto via gunicorn (Railway).
# Ordem: init_db (cria data/ + tabelas base) → seed_data → init_competicoes → seed_competicoes.
# Tudo idempotente: CREATE TABLE IF NOT EXISTS + checagens de "já populado".
init_db()
seed_data()
init_competicoes()
seed_competicoes()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("RAILWAY_ENVIRONMENT") is None
    print(f"\n🏊  Natacao Dashboard em http://localhost:{port}\n")
    app.run(debug=debug, host="0.0.0.0", port=port)
