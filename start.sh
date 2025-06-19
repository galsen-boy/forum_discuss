#!/bin/bash

# Lancer le backend dans un nouveau terminal (installation des dépendances incluse)
cd backend && pip install -r requirements.txt --break-system-packages && python3 app.py; exec bash

# Lancer le frontend dans un autre terminal (installation des dépendances incl
cd frontend && npm install && npm start; exec bash