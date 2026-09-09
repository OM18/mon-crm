"""
Scrape le prix du contrat front-month du maïs (CBOT corn) sur la page publique CME Group.

URL : https://www.cmegroup.com/markets/agriculture/grains/corn
Cible : div.contract-data.loaded > div.last-value  .value
                                   > div.price-change .value

NOTE IMPORTANTE :
CME Group protège cette page avec un WAF anti-bot. Un simple `requests.get()`
(même avec un User-Agent de navigateur) a de bonnes chances de recevoir une
réponse 403 Forbidden, car le contenu peut aussi être injecté en JavaScript
après le chargement initial (rendu côté client), auquel cas BeautifulSoup ne
trouvera rien même si la requête HTTP réussit.
Si ce script ne trouve pas les éléments, la cause la plus probable est l'une
de ces deux protections côté CME, pas une erreur de sélecteur.
"""

import sys
import requests
from bs4 import BeautifulSoup

URL = "https://www.cmegroup.com/markets/agriculture/grains/corn"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
}


def fetch_corn_price(url: str = URL, timeout: int = 15) -> dict:
    resp = requests.get(url, headers=HEADERS, timeout=timeout)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    container = soup.find("div", class_="contract-data loaded")
    if container is None:
        raise RuntimeError(
            "div.contract-data.loaded introuvable dans la page — "
            "probablement rendu en JS ou bloqué par le WAF CME."
        )

    last_value_div = container.find("div", class_="last-value")
    price_change_div = container.find("div", class_="price-change")

    if last_value_div is None or price_change_div is None:
        raise RuntimeError(
            "div.last-value ou div.price-change introuvable dans contract-data.loaded."
        )

    last_value = last_value_div.find(class_="value")
    price_change = price_change_div.find(class_="value")

    if last_value is None or price_change is None:
        raise RuntimeError("Élément .value introuvable dans last-value/price-change.")

    return {
        "last_value": last_value.get_text(strip=True),
        "price_change": price_change.get_text(strip=True),
    }


if __name__ == "__main__":
    try:
        data = fetch_corn_price()
        print(f"Dernier prix : {data['last_value']}")
        print(f"Variation    : {data['price_change']}")
    except requests.exceptions.HTTPError as e:
        print(f"Erreur HTTP (probable blocage anti-bot CME) : {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Erreur : {e}", file=sys.stderr)
        sys.exit(1)
