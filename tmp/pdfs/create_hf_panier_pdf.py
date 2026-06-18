from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
PDF_PATH = OUT_DIR / "integration_modele_huggingface_panier_souki.pdf"


PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 1.65 * cm
MARGIN_TOP = 1.55 * cm
MARGIN_BOTTOM = 1.45 * cm


def build_styles():
    base = getSampleStyleSheet()
    styles = {}
    styles["title"] = ParagraphStyle(
        "SoukiTitle",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=26,
        textColor=colors.HexColor("#1E8A3C"),
        spaceAfter=10,
    )
    styles["subtitle"] = ParagraphStyle(
        "SoukiSubtitle",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor("#455A46"),
        spaceAfter=14,
    )
    styles["h1"] = ParagraphStyle(
        "SoukiH1",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#1E8A3C"),
        spaceBefore=12,
        spaceAfter=7,
    )
    styles["h2"] = ParagraphStyle(
        "SoukiH2",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12.2,
        leading=15,
        textColor=colors.HexColor("#264129"),
        spaceBefore=9,
        spaceAfter=5,
    )
    styles["body"] = ParagraphStyle(
        "SoukiBody",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=9.3,
        leading=13.2,
        textColor=colors.HexColor("#26352A"),
        spaceAfter=6,
        alignment=TA_LEFT,
    )
    styles["small"] = ParagraphStyle(
        "SoukiSmall",
        parent=styles["body"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#5E6C60"),
    )
    styles["bullet"] = ParagraphStyle(
        "SoukiBullet",
        parent=styles["body"],
        leftIndent=11,
        firstLineIndent=-7,
        spaceAfter=3.5,
    )
    styles["code"] = ParagraphStyle(
        "SoukiCode",
        parent=base["Code"],
        fontName="Courier",
        fontSize=7.2,
        leading=9.2,
        textColor=colors.HexColor("#102018"),
    )
    styles["callout"] = ParagraphStyle(
        "SoukiCallout",
        parent=styles["body"],
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#7A4C0E"),
        backColor=colors.HexColor("#FFF7EE"),
        borderColor=colors.HexColor("#F3D8B2"),
        borderWidth=0.6,
        borderPadding=7,
        leading=13,
    )
    return styles


styles = build_styles()


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#DDEBDD"))
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_X, PAGE_HEIGHT - 1.05 * cm, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 1.05 * cm)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.HexColor("#1E8A3C"))
    canvas.drawString(MARGIN_X, PAGE_HEIGHT - 0.72 * cm, "SOUKI - Integration du modele Hugging Face")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6F8070"))
    canvas.drawRightString(PAGE_WIDTH - MARGIN_X, 0.78 * cm, f"Page {doc.page}")
    canvas.restoreState()


def p(text: str, style="body"):
    return Paragraph(text, styles[style])


def bullets(items: list[str]):
    return ListFlowable(
        [ListItem(p(item, "bullet"), bulletColor=colors.HexColor("#1E8A3C")) for item in items],
        bulletType="bullet",
        leftIndent=13,
        bulletFontName="Helvetica-Bold",
        bulletFontSize=6,
    )


def code(text: str):
    return Preformatted(text.strip("\n"), styles["code"])


def table(data, widths):
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAF8EC")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1E8A3C")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("LEADING", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#DDEBDD")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FBFDF9")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def section(title: str):
    return p(title, "h1")


def subsection(title: str):
    return p(title, "h2")


def story():
    content = []
    content.append(p("Integration du modele Hugging Face pour la generation automatique de panier", "title"))
    content.append(
        p(
            "Document technique de synthese pour le rapport de donnees et la partie implementation. "
            "Il retrace le besoin, les choix d'architecture, le deploiement gratuit via Hugging Face Space, "
            "l'integration backend/frontend, les tests effectues et les limites observees.",
            "subtitle",
        )
    )
    content.append(
        table(
            [
                ["Element", "Valeur"],
                ["Projet", "SOUKI - Panier intelligent IA"],
                ["Modele", "TahaBDI/gemma-2-2b-panier-merged"],
                ["Service applicatif", "FastAPI backend + Next.js frontend"],
                ["Deploiement gratuit retenu", "Hugging Face Space Docker CPU Basic"],
                ["Endpoint backend", "POST /api/paniers/generer"],
            ],
            [4.2 * cm, 11.8 * cm],
        )
    )
    content.append(Spacer(1, 8))

    content.append(section("1. Objectif de l'integration"))
    content.append(
        p(
            "L'objectif etait de remplacer un service ML de test par un service reel capable de generer "
            "un panier automatique a partir des choix de l'utilisateur: budget, nombre de personnes, duree "
            "et profil culinaire. Le resultat doit ensuite etre transforme en lignes panier exploitables par "
            "le checkout avec les produits, quantites, prix exacts et niveaux catalogue deja presents dans l'application."
        )
    )
    content.append(
        bullets(
            [
                "Utiliser le modele final merge depose sur Hugging Face.",
                "Transformer les criteres utilisateur en prompt envoye au modele.",
                "Parser une reponse JSON contenant une composition de produits.",
                "Mapper la sortie du modele vers les produits reels du catalogue SOUKI.",
                "Appliquer les prix backend exacts: prix_affiche puis prix_kg.",
                "Verifier stock, niveaux 1/2/3, quantites positives et persistance du panier.",
                "Envoyer l'utilisateur vers le checkout avec un panier_id fiable.",
            ]
        )
    )

    content.append(section("2. Architecture cible"))
    content.append(
        p(
            "L'architecture finale garde le backend comme source de verite. Le frontend ne calcule pas les prix "
            "et ne fait pas confiance directement au modele. Il envoie seulement les criteres du panier intelligent. "
            "Le backend interroge le modele, normalise la reponse, consulte la base de donnees et cree un panier brouillon."
        )
    )
    content.append(
        table(
            [
                ["Couche", "Responsabilite"],
                ["Frontend Next.js", "Afficher la modale IA, collecter budget/personnes/duree/profil, appeler /api/paniers/generer."],
                ["Controller panier", "Exposer POST /api/paniers/generer et recuperer l'utilisateur connecte."],
                ["MLPanierService", "Construire le prompt, appeler HF/Space, parser JSON, appliquer les regles metier."],
                ["IPanierDao / PanierDaoBD", "Lire les produits actifs, creer panier brouillon et lignes panier."],
                ["Checkout", "Recharger le panier via panier_id et finaliser la commande."],
            ],
            [4.1 * cm, 11.9 * cm],
        )
    )

    content.append(section("3. Deploiement gratuit sur Hugging Face"))
    content.append(
        p(
            "Le serverless Hugging Face Inference n'a pas pu servir directement le repo modele: le provider a indique "
            "que le modele n'etait pas supporte. Pour rester en gratuit, l'option retenue est un Hugging Face Space "
            "Docker CPU Basic. Ce choix permet d'exposer une API HTTP compatible avec le backend, au prix d'un premier "
            "appel plus lent et d'une capacite CPU limitee."
        )
    )
    content.append(subsection("3.1 Creation du Space"))
    content.append(
        bullets(
            [
                "Creer un Space: TahaBDI/souki-panier-api.",
                "Choisir SDK Docker.",
                "Choisir Hardware CPU Basic - Free.",
                "Ajouter les secrets HF_TOKEN et MODEL_REPO_ID.",
                "Garder le Space private si le modele doit rester protege.",
            ]
        )
    )
    content.append(subsection("3.2 Fichiers du Space"))
    content.append(p("README.md", "h2"))
    content.append(
        code(
            """
---
title: Souki Panier API
sdk: docker
app_port: 7860
models:
  - TahaBDI/gemma-2-2b-panier-merged
---
"""
        )
    )
    content.append(p("Dockerfile", "h2"))
    content.append(
        code(
            """
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \\
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
"""
        )
    )
    content.append(p("requirements.txt", "h2"))
    content.append(
        code(
            """
fastapi==0.115.6
uvicorn[standard]==0.34.0
transformers==4.48.0
accelerate==1.2.1
torch==2.5.1
safetensors==0.4.5
pydantic==2.10.4
"""
        )
    )
    content.append(PageBreak())
    content.append(p("app.py - version API simplifiee", "h2"))
    content.append(
        code(
            """
import json, os, re, torch
from typing import Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_REPO_ID = os.getenv("MODEL_REPO_ID", "TahaBDI/gemma-2-2b-panier-merged")
HF_TOKEN = os.getenv("HF_TOKEN")
app = FastAPI(title="Souki Panier API")
tokenizer = None
model = None

class GenerateRequest(BaseModel):
    inputs: str
    parameters: dict[str, Any] | None = None
    options: dict[str, Any] | None = None

def load_model():
    global tokenizer, model
    if tokenizer is not None and model is not None:
        return
    tokenizer = AutoTokenizer.from_pretrained(MODEL_REPO_ID, token=HF_TOKEN, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_REPO_ID, token=HF_TOKEN, torch_dtype=torch.float32,
        low_cpu_mem_usage=True, trust_remote_code=True
    )
    model.eval()

@app.get("/")
def health():
    return {"status": "ok", "model": MODEL_REPO_ID, "loaded": tokenizer is not None and model is not None}

@app.post("/")
def generate(payload: GenerateRequest):
    try:
        load_model()
        params = payload.parameters or {}
        inputs = tokenizer(payload.inputs, return_tensors="pt")
        with torch.inference_mode():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=int(params.get("max_new_tokens", 512)),
                do_sample=bool(params.get("do_sample", False)),
                pad_token_id=tokenizer.eos_token_id,
            )
        generated = tokenizer.decode(output_ids[0], skip_special_tokens=True)
        if generated.startswith(payload.inputs):
            generated = generated[len(payload.inputs):].strip()
        return [{"generated_text": generated}]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
"""
        )
    )

    content.append(section("4. Configuration backend SOUKI"))
    content.append(
        p(
            "Le backend est configure par le fichier back-end/.env. L'URL du Space remplace l'ancien endpoint "
            "serverless Hugging Face. Le token est necessaire si le Space est prive."
        )
    )
    content.append(
        code(
            """
SOUKI_ML_INFERENCE_URL=https://tahabdi-souki-panier-api.hf.space/
HF_TOKEN=hf_xxxxxxxxxxxxxxxxx
SOUKI_ML_PRELOAD_MODEL=1
SOUKI_ML_PRELOAD_TIMEOUT_SECONDS=180
"""
        )
    )
    content.append(
        p(
            "Le chargement des variables d'environnement a ete ajuste afin que le fichier .env backend prenne bien "
            "le dessus sur une variable deja presente dans le terminal. Cela evite qu'une ancienne valeur comme "
            "SOUKI_ML_PRELOAD_MODEL=0 reste active malgre la modification du fichier."
        )
    )

    content.append(section("5. Integration backend"))
    content.append(
        bullets(
            [
                "Ajout de panier_id dans PanierResponseDTO.",
                "Extension de IPanierDao avec get_active_products_for_ml.",
                "Implementation de get_active_products_for_ml dans PanierDaoBD.",
                "Injection de IPanierDao dans MLPanierService via dependencies.py.",
                "Suppression du couplage direct du service ML vers PanierDaoBD.",
                "Creation du panier brouillon et des lignes panier apres generation.",
                "Warmup remote optionnel au demarrage si SOUKI_ML_PRELOAD_MODEL=1.",
            ]
        )
    )
    content.append(subsection("5.1 Flux d'execution"))
    content.append(
        table(
            [
                ["Etape", "Description"],
                ["1", "Le frontend envoie budget, personnes, duree et profil."],
                ["2", "Le controller /api/paniers/generer recupere l'utilisateur connecte."],
                ["3", "Le service lit les produits actifs en stock via IPanierDao."],
                ["4", "Le prompt est construit avec les criteres et le catalogue."],
                ["5", "Le Space HF retourne une composition JSON."],
                ["6", "Le backend mappe chaque item vers Product et applique les prix exacts."],
                ["7", "Le panier est complete pour respecter les niveaux 1, 2 et 3 si disponibles."],
                ["8", "Le panier brouillon est cree en base et son panier_id est renvoye au frontend."],
            ],
            [2.0 * cm, 14.0 * cm],
        )
    )

    content.append(section("6. Integration frontend"))
    content.append(
        bullets(
            [
                "La modale IA appelle generateSmartPanier dans front-end/lib/catalogue.ts.",
                "Le bouton Aller au checkout transmet source=smart et panier_id.",
                "Le checkout recharge les lignes depuis /api/paniers/{panier_id}.",
                "Une interface de suggestions par niveau apparait sous le panier genere.",
                "Les profils du modele sont maintenant visibles sous forme de grille selectionnable.",
            ]
        )
    )
    content.append(
        table(
            [
                ["Profil visible", "Objectif"],
                ["Equilibre", "Panier varie pour usage general."],
                ["Legumes de base", "Essentiels du quotidien."],
                ["Salade fraicheur", "Produits frais et crudites."],
                ["Soupe hiver", "Legumes adaptes aux soupes."],
                ["Cuisine tajine", "Selection orientee plats marocains."],
                ["Cuisine couscous", "Profil couscous complet."],
                ["Fruits dominant", "Panier avec plus de fruits."],
                ["Legumes verts", "Produits verts et legers."],
                ["Racines & tubercules", "Produits comme pommes de terre et carottes."],
                ["Aromates & herbes", "Menthe, persil, coriandre et aromates."],
            ],
            [4.6 * cm, 11.4 * cm],
        )
    )

    content.append(section("7. Tests et constats"))
    content.append(
        bullets(
            [
                "Verification des routes FastAPI: /api/paniers/generer est bien enregistree.",
                "Verification du frontend: la modale smart appelle bien /api/paniers/generer.",
                "Test du provider HF serverless: refus avec Model not supported by provider hf-inference.",
                "Correction vers Hugging Face Space gratuit comme endpoint externe.",
                "Verification TypeScript: tsc --noEmit OK.",
                "Verification Python: py_compile OK sur les fichiers backend modifies.",
                "Correction catalogue: Aubergines remises a 8 DH dans prix_kg, prix_gros_saisi et prix_affiche.",
            ]
        )
    )
    content.append(p("Point important", "h2"))
    content.append(
        p(
            "Si le Space est prive, l'ouverture directe de https://tahabdi-souki-panier-api.hf.space/ dans le navigateur "
            "peut afficher 404. Ce comportement est normal. Le backend doit appeler le Space avec Authorization: Bearer HF_TOKEN.",
            "callout",
        )
    )

    content.append(section("8. Limites de l'option gratuite"))
    content.append(
        bullets(
            [
                "CPU Basic gratuit peut etre lent pour Gemma 2B.",
                "Le premier appel peut prendre plusieurs minutes car le Space charge le modele.",
                "Le Space peut dormir apres inactivite.",
                "Une erreur memoire est possible si le modele est trop lourd en float32.",
                "Pour production stable, un Inference Endpoint dedie reste plus robuste mais payant.",
            ]
        )
    )

    content.append(section("9. Checklist de reprise"))
    content.append(
        table(
            [
                ["Verification", "Commande ou action"],
                ["Space actif", "Ouvrir le Space dans Hugging Face et verifier Running."],
                ["Health API", "GET / avec token si Space prive."],
                ["Variables backend", "Verifier SOUKI_ML_INFERENCE_URL, HF_TOKEN, SOUKI_ML_PRELOAD_MODEL."],
                ["Backend", "Redemarrer uvicorn apres modification du .env."],
                ["Catalogue", "Verifier Aubergines: prix_kg=8, prix_affiche=8."],
                ["Frontend", "Ouvrir catalogue, Panier intelligent, choisir un profil visible."],
                ["Checkout", "Confirmer que l'URL contient panier_id et que les lignes se rechargent."],
            ],
            [4.0 * cm, 12.0 * cm],
        )
    )
    content.append(Spacer(1, 8))
    content.append(
        p(
            "Conclusion: le service SOUKI conserve la logique metier dans le backend, le modele HF sert uniquement "
            "a proposer une composition, et le checkout s'appuie sur les donnees catalogue fiables de la base. "
            "Cette separation limite les erreurs de prix, de stock et de produits inexistants.",
            "callout",
        )
    )
    return content


def main():
    doc = BaseDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title="Integration modele Hugging Face - Panier SOUKI",
        author="SOUKI",
    )
    frame = Frame(
        MARGIN_X,
        MARGIN_BOTTOM,
        PAGE_WIDTH - 2 * MARGIN_X,
        PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - 0.25 * cm,
        id="normal",
    )
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    doc.build(story())
    print(PDF_PATH)


if __name__ == "__main__":
    main()
