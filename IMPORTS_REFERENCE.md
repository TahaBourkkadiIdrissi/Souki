# 📦 Tous les Imports Python - Notebook Souki Optimisé

## 📋 Liste Complète des Imports

Ce fichier documente tous les imports utilisés dans le notebook optimisé.

---

## 1️⃣ Google Colab & Drive

```python
# Montage automatique du Google Drive
from google.colab import drive

# Utilisation:
drive.mount('/content/drive')  # Mount sur /content/drive
```

---

## 2️⃣ Transformers & Modèles

```python
# Chargement des modèles
from transformers import (
    AutoTokenizer,              # Tokenizer du modèle
    AutoModelForCausalLM,       # Modèle pour génération
    BitsAndBytesConfig,         # Configuration quantization 4-bit
)

# Configuration d'entraînement
from transformers import EarlyStoppingCallback  # Arrêt automatique

# Utilisation:
tokenizer = AutoTokenizer.from_pretrained("google/gemma-2-2b")
model = AutoModelForCausalLM.from_pretrained("google/gemma-2-2b")
```

---

## 3️⃣ PEFT - LoRA & Fine-tuning

```python
from peft import (
    LoraConfig,                 # Configuration LoRA
    TaskType,                   # Type de tâche (ex: CAUSAL_LM)
    prepare_model_for_kbit_training,  # Préparation pour QLoRA
    AutoPeftModelForCausalLM,   # Modèle avec LoRA
)

# Utilisation:
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    task_type=TaskType.CAUSAL_LM,
)

model = prepare_model_for_kbit_training(model)
```

---

## 4️⃣ TRL - Supervised Fine-Tuning

```python
from trl import (
    SFTTrainer,    # Trainer pour fine-tuning supervisé
    SFTConfig,     # Configuration du trainer
)

# Utilisation:
training_args = SFTConfig(
    output_dir="./model_output",
    learning_rate=2e-4,
    num_train_epochs=100,
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
    tokenizer=tokenizer,
)
```

---

## 5️⃣ Datasets - Hugging Face

```python
from datasets import (
    Dataset,        # Dataset unique
    DatasetDict,    # Dictionnaire de datasets (train/val/test)
)

# Utilisation:
dataset = Dataset.from_list(data)

dataset_dict = DatasetDict({
    "train": train_dataset,
    "validation": val_dataset,
    "test": test_dataset,
})
```

---

## 6️⃣ PyTorch - Tenseurs & Calcul

```python
import torch

# Utilisation:
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
tensor = torch.tensor([1, 2, 3]).to(device)
model = model.to(device)

# Détection GPU
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"GPU count: {torch.cuda.device_count()}")
```

---

## 7️⃣ JSON & Text Processing

```python
import json
import re

# JSON
data = json.loads(json_string)  # Parser JSON
json.dumps(data, indent=2, ensure_ascii=False)  # Écrire JSON

# Regex
matches = re.findall(r'\[.*?\]', text, re.DOTALL)  # Extraire array
cleaned = re.sub(r',(\s*[}\]])', r'\1', text)     # Supprimer virgules
```

---

## 8️⃣ Data Science & Pandas

```python
import pandas as pd
import numpy as np

# DataFrame
df = pd.DataFrame({"col1": [1, 2], "col2": [3, 4]})
print(df.to_string())

# Arrays
array = np.array([1, 2, 3])
```

---

## 9️⃣ Utilitaires Système

```python
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime
import inspect
import subprocess
import time
import math

# Utilisation:
path = Path("./model")
path.mkdir(parents=True, exist_ok=True)  # Créer répertoire

timestamp = datetime.now().isoformat()   # Date/heure

shutil.copytree("src", "dst")            # Copier dossier

math.exp(1.5)                            # Exponential (perplexité)
```

---

## 🔟 Imports Optionnels (Si besoin)

```python
# BitsAndBytes pour quantization
import bitsandbytes as bnb

# Matplotlib pour graphiques
import matplotlib.pyplot as plt

# Tqdm pour barres de progression
from tqdm import tqdm

# Logging avancé
import logging
logging.getLogger("transformers").setLevel(logging.WARNING)
```

---

## 📋 Bloc Complet d'Imports (Copier-Coller)

```python
# ═══════════════════════════════════════════════════════════════
# IMPORTS COMPLETS - Copier au début du notebook
# ═══════════════════════════════════════════════════════════════

# Google Colab
try:
    from google.colab import drive
    IS_COLAB = True
except ImportError:
    IS_COLAB = False

# Transformers
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    EarlyStoppingCallback,
)

# PEFT - Low-Rank Adaptation
from peft import (
    LoraConfig,
    TaskType,
    prepare_model_for_kbit_training,
    AutoPeftModelForCausalLM,
)

# TRL - Supervised Fine-Tuning
from trl import SFTTrainer, SFTConfig

# Datasets
from datasets import Dataset, DatasetDict

# Data Science
import pandas as pd
import numpy as np
import torch
import json
import re

# System & Utils
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime
import inspect
import subprocess
import time
import math

# Optional
try:
    import bitsandbytes as bnb
    BITSANDBYTES_AVAILABLE = True
except ImportError:
    BITSANDBYTES_AVAILABLE = False

# ═══════════════════════════════════════════════════════════════
```

---

## 🎯 Imports par Étape du Notebook

### Étape 1: Setup & Installation
```python
import subprocess
import sys
```

### Étape 2: Chargement des Données
```python
import pandas as pd
import numpy as np
import json
from pathlib import Path
```

### Étape 3: Préparation Dataset
```python
from datasets import Dataset, DatasetDict
```

### Étape 4: Tokenization
```python
from transformers import AutoTokenizer
```

### Étape 5: Chargement Modèle
```python
import torch
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import prepare_model_for_kbit_training
import bitsandbytes as bnb
```

### Étape 6: Configuration LoRA & Trainer
```python
from peft import LoraConfig, TaskType
from trl import SFTTrainer, SFTConfig
from transformers import EarlyStoppingCallback
import inspect
```

### Étape 7: Entraînement
```python
import time
from datetime import datetime
```

### Étape 8: Validation JSON
```python
import json
import re
from typing import Any, Optional, Dict, List
```

### Étape 9: Inférence
```python
import pandas as pd
from peft import AutoPeftModelForCausalLM
```

### Étape 10: Sauvegarde
```python
import shutil
from datetime import datetime
```

---

## 🔧 Dépannage des Imports

### ❌ ImportError: No module named 'transformers'

**Solution**:
```bash
pip install transformers==4.46.3
```

### ❌ ImportError: No module named 'peft'

**Solution**:
```bash
pip install peft==0.13.2
```

### ❌ ImportError: No module named 'trl'

**Solution**:
```bash
pip install trl
```

### ❌ ImportError: No module named 'bitsandbytes'

**Solution** (GPU uniquement):
```bash
pip install bitsandbytes==0.44.1
```

---

## 📊 Versions Requises

```
transformers==4.46.3    (IMPORTANT: exactement cette version)
peft==0.13.2            (IMPORTANT: exactement cette version)
trl>=0.12.2             (TRL)
accelerate==1.1.1       (IMPORTANT)
datasets==2.21.0        (IMPORTANT)
bitsandbytes==0.44.1    (GPU uniquement)
torch>=2.1.0            (IMPORTANT)
```

---

## ✅ Vérifier Imports

```python
# Script pour vérifier tous les imports
import sys

REQUIRED_PACKAGES = {
    "transformers": "4.46.3",
    "peft": "0.13.2",
    "trl": "0.12.2",
    "accelerate": "1.1.1",
    "datasets": "2.21.0",
    "torch": "2.1.0+",
}

for pkg, version in REQUIRED_PACKAGES.items():
    try:
        module = __import__(pkg)
        installed_version = getattr(module, "__version__", "unknown")
        status = "✅" if installed_version.startswith(version.split("+")[0]) else "⚠️"
        print(f"{status} {pkg}: {installed_version} (requires {version})")
    except ImportError:
        print(f"❌ {pkg}: NOT INSTALLED")
```

---

## 🎓 Conseils

1. **Copier le bloc complet d'imports** au début du notebook
2. **Ne pas changer les versions** sauf si problème spécifique
3. **Vérifier les imports** avant de lancer l'entraînement
4. **Ignorer les warnings** de dépréciations mineures

---

**Document généré pour**: Notebook Souki - Deep Learning Optimisé  
**Version**: 2.0  
**Dernière mise à jour**: May 2025
