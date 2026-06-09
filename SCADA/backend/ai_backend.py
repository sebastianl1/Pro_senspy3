from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime
from typing import List, Optional

load_dotenv()

app = FastAPI(title="SCADA AI Backend")

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =================================================================
# ÁREA DE CONFIGURACIÓN (No tocar la lógica de abajo)
# =================================================================
# Define aquí qué variables quieres mostrar en cada parte del SCADA
SCADA_CONFIG = {
    "process_variables": [
        {"id": "95", "var20": "1", "name": "pH Entrada", "desc": "pH Entrada Planta", "table": "variable2", "col": "var1", "unit": "pH"},
        {"id": "95", "var20": "2", "name": "Turbiedad Entrada", "desc": "Turbiedad Entrada Planta", "table": "variable2", "col": "var1", "unit": "NTU"},
        {"id": "95", "var20": "1", "name": "pH Salida", "desc": "pH Salida Planta", "table": "variable2", "col": "var2", "unit": "pH"},
        {"id": "95", "var20": "2", "name": "Turbiedad Salida", "desc": "Turbiedad Salida Planta", "table": "variable2", "col": "var9", "unit": "NTU"},
        {"id": "95", "var20": "2", "name": "Cloro Salida", "desc": "Cloro Salida Planta", "table": "variable2", "col": "var17", "unit": "mg/L"}
    ],
    "charts": {
        "histChart": [
            {"id": "95", "var20": "1", "label": "pH Entrada", "table": "variable2", "col": "var1"},
            {"id": "95", "var20": "2", "label": "Turbiedad Entrada", "table": "variable2", "col": "var1"},
            {"id": "95", "var20": "1", "label": "pH Salida", "table": "variable2", "col": "var2"},
            {"id": "95", "var20": "2", "label": "Turbiedad Salida", "table": "variable2", "col": "var9"},
            {"id": "95", "var20": "2", "label": "Cloro Salida", "table": "variable2", "col": "var17"}
        ]
    }
}

# Configuración de Base de Datos
DB_PARAMS = {
    'database': '',
    'user': '',
    'password': '',
    'host': '',
    'port': ,
    'connect_timeout': 5
}

# =================================================================
# MODELOS DE DATOS
# =================================================================
class ChatMessage(BaseModel):
    message: str

class DataPoint(BaseModel):
    x: str
    y: float

class SeriesData(BaseModel):
    label: str
    data: List[DataPoint]

# =================================================================
# LÓGICA DEL SISTEMA
# =================================================================

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "TU_API_KEY_AQUI"))

def get_db_connection():
    return psycopg2.connect(**DB_PARAMS)

@app.get("/api/data/quick")
async def get_quick_data(
    table: str = "variable2",
    col: str = "var1",
    id: str = "95",
    var20: str = "1"
):
    """Retorna el último valor para una combinación de tabla/columna específica"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        query = f"""
            SELECT fecha, {col} as valor 
            FROM {table} 
            WHERE iddispositivo = %s AND VAR20 = %s 
            ORDER BY fecha DESC LIMIT 1
        """
        print(f"DEBUG SQL: {query} % ({id}, {var20})")
        cur.execute(query, (id, var20))
        row = cur.fetchone()
        
        result = None
        if row:
            print(f"DEBUG RESULT: {row}")
            result = {
                "val": float(row["valor"]),
                "time": row["fecha"].strftime("%H:%M:%S")
            }
        
        cur.close()
        conn.close()
        return result
    except Exception as e:
        # No simulamos nada, si falla devolvemos el error o null
        return {"error": str(e), "val": None}

@app.get("/api/data/history")
async def get_history(
    table: str = "variable2",
    col: str = "var1",
    id: str = "95",
    var20: str = "1",
    range: str = "24h"
):
    """Retorna serie histórica para una variable específica"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        since = None
        if range == "1h": since = "INTERVAL '1 hour'"
        elif range == "24h": since = "INTERVAL '24 hours'"
        elif range == "7d": since = "INTERVAL '7 days'"
        elif range == "30d": since = "INTERVAL '30 days'"
        
        query_filter = f"AND fecha >= NOW() - {since}" if since else ""

        # Obtenemos los últimos 200 puntos dentro del rango y luego los ordenamos
        query = f"""
            SELECT * FROM (
                SELECT fecha, {col} as valor 
                FROM {table} 
                WHERE iddispositivo = %s AND VAR20 = %s {query_filter}
                ORDER BY fecha DESC LIMIT 1000
            ) as sub 
            ORDER BY fecha ASC
        """
        print(f"DEBUG SQL HISTORY: {query} % ({id}, {var20})")
        cur.execute(query, (int(id), int(var20)))
        rows = cur.fetchall()
        print(f"DEBUG RESULT HISTORY: {len(rows)} rows found")
        
        data_points = []
        for r in rows:
            data_points.append({
                "x": r["fecha"].isoformat(),
                "y": float(r["valor"])
            })
            
        cur.close()
        conn.close()
        return data_points
    except Exception as e:
        return []

@app.post("/api/chat")
async def chat(msg: ChatMessage):
    """Atiende consultas del chat usando GPT-4o y contexto de la base de datos"""
    try:
        # Contexto simplificado para la IA
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT iddispositivo, var20, valor FROM variable2_quick LIMIT 10")
        context = cur.fetchall()
        cur.close()
        conn.close()

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"Eres el asistente SCADA profesional. Datos actuales: {context}"},
                {"role": "user", "content": msg.message}
            ]
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
