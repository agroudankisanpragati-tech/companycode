# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/tests/test_full_pipeline.py
# Purpose: COMPLETE AUTOMATED TEST SUITE — all intents, all languages
# Run: python intent_engine/tests/test_full_pipeline.py
#   or: python -m pytest intent_engine/tests/test_full_pipeline.py -v
# =============================================================================
from __future__ import annotations
import sys
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

TEST_CASES: list[tuple[str, str]] = [
    # GREETING
    ("Namaste", "greeting"), ("Hello", "greeting"), ("Hi", "greeting"),
    ("नमस्ते", "greeting"), ("राम राम", "greeting"), ("Ram Ram sa", "greeting"),
    ("Khamma ghani", "greeting"), ("Sat sri akal", "greeting"),
    ("Good morning", "greeting"), ("Suprabhat", "greeting"),
    ("Kaise ho", "greeting"), ("Kem cho", "greeting"),
    ("Adaab", "greeting"), ("Vanakkam", "greeting"),
    ("Radhe radhe", "greeting"), ("start", "greeting"),
    ("namste bhai", "greeting"), ("helo ji", "greeting"),

    # MARKET
    ("मंडी भाव", "market"), ("mandi bhav", "market"),
    ("आज का मंडी भाव", "market"), ("aaj ka mandi bhav kya hai", "market"),
    ("गेहूं का भाव", "market"), ("wheat price today", "market"),
    ("sarson ka bhav batao", "market"), ("सरसों का रेट", "market"),
    ("Market rate", "market"), ("Today mandi rate", "market"),
    ("bhav", "market"), ("rate", "market"), ("मंडी", "market"),
    ("बाजार भाव", "market"), ("MSP kya hai", "market"),
    ("fasal ka bhav", "market"), ("म्हाने मंडी भाव बतावो", "market"),
    ("आज रो भाव", "market"), ("Mandi", "market"), ("Price", "market"),
    ("नीलामी", "market"), ("fasal kahan bechu", "market"),
    ("aaj mandi mein gehu ka bhav kya hai", "market"),
    ("kota mandi mein soybean ka rate", "market"),
    ("Should I sell today", "market"), ("mandi ka bhav bata do", "market"),

    # WEATHER
    ("मौसम", "weather"), ("mausam kaisa hai", "weather"),
    ("aaj ka mausam batao", "weather"), ("weather today", "weather"),
    ("barish hogi kya", "weather"), ("बारिश कब होगी", "weather"),
    ("temperature kitna hai", "weather"), ("garmi kitni hai", "weather"),
    ("kal ka mausam", "weather"), ("weather forecast", "weather"),
    ("rain today", "weather"), ("thand kitni hai", "weather"),
    ("fog aaj hai kya", "weather"), ("storm aayega kya", "weather"),
    ("मौसम की जानकारी", "weather"), ("aaj barish hogi", "weather"),
    ("barish kab hogi bhai", "weather"),

    # DISEASE
    ("मेरी फसल में बीमारी है", "disease"),
    ("fasal mein rog lag gaya", "disease"),
    ("crop disease", "disease"), ("पत्ते पीले हो रहे हैं", "disease"),
    ("patte peele ho rahe hain", "disease"),
    ("leaf spot on wheat", "disease"), ("fungus on crop", "disease"),
    ("blast disease", "disease"), ("jhulsa rog", "disease"),
    ("fasal kharab ho rahi hai", "disease"),
    ("blight on tomato", "disease"), ("rust on wheat", "disease"),
    ("powdery mildew", "disease"), ("wilt disease", "disease"),
    ("root rot", "disease"), ("stem rot", "disease"),
    ("tikka rog", "disease"), ("fasal sukh rahi hai", "disease"),
    ("रोग पहचान", "disease"), ("fasal mein rog hai kya karu", "disease"),

    # PEST
    ("कीड़े लग गए", "pest"), ("keede lag gaye", "pest"),
    ("pest attack", "pest"), ("टिड्डी दल", "pest"),
    ("tiddi dal", "pest"), ("aphid on crop", "pest"),
    ("माहू कीट", "pest"), ("whitefly infestation", "pest"),
    ("stem borer", "pest"), ("caterpillar eating leaves", "pest"),
    ("sundi patte kha rahi hai", "pest"), ("locust attack", "pest"),
    ("keet ki dawa batao", "pest"), ("pest control kaise kare", "pest"),
    ("कीट नियंत्रण", "pest"), ("insecticide for aphid", "pest"),
    ("bollworm in cotton", "pest"), ("fasal mein illi", "pest"),
    ("mite on crop", "pest"), ("grasshopper attack", "pest"),
    ("meri fasal mein keede hain kya karu", "pest"),

    # GOVERNMENT
    ("PM Kisan yojana", "government"), ("सरकारी योजना", "government"),
    ("pm kisan samman nidhi", "government"),
    ("fasal bima yojana", "government"), ("crop insurance", "government"),
    ("kisan credit card", "government"),
    ("subsidy kaise milegi", "government"),
    ("government scheme for farmers", "government"),
    ("pmfby kya hai", "government"),
    ("kisan registration kaise kare", "government"),
    ("soil health card", "government"), ("e-nam portal", "government"),
    ("loan kaise milega", "government"), ("anudan kaise milega", "government"),
    ("सरकारी मदद", "government"),
    ("sarkar ki yojna batao", "government"),

    # SOIL
    ("मिट्टी की जांच", "soil"), ("mitti test kaise kare", "soil"),
    ("soil health", "soil"), ("soil testing", "soil"),
    ("ph level of soil", "soil"), ("mitti ka ph", "soil"),
    ("nitrogen deficiency in soil", "soil"),
    ("organic carbon in soil", "soil"), ("soil report", "soil"),
    ("mitti ki upjau shakti", "soil"), ("black soil", "soil"),
    ("sandy soil", "soil"), ("soil improvement", "soil"),
    ("मिट्टी सुधार", "soil"), ("zinc deficiency soil", "soil"),
    ("mitti ki janch karni hai", "soil"),

    # FERTILIZER
    ("खाद कौन सी डालूं", "fertilizer"), ("khad batao", "fertilizer"),
    ("urea kitna dalna chahiye", "fertilizer"),
    ("DAP fertilizer", "fertilizer"), ("NPK kya hai", "fertilizer"),
    ("vermicompost kaise banaye", "fertilizer"),
    ("organic fertilizer", "fertilizer"), ("jaivik khad", "fertilizer"),
    ("fertilizer dose for wheat", "fertilizer"),
    ("khad ki kami", "fertilizer"), ("nutrient deficiency", "fertilizer"),
    ("top dressing kab kare", "fertilizer"), ("foliar spray", "fertilizer"),
    ("gobar khad", "fertilizer"), ("खाद की मात्रा", "fertilizer"),
    ("khad kab dalna chahiye", "fertilizer"),

    # CROP
    ("कौन सी फसल लगाऊं", "crop"), ("konsi fasal lagaun", "crop"),
    ("crop recommendation", "crop"),
    ("best crop for this season", "crop"),
    ("rabi fasal kya hai", "crop"), ("kharif crops", "crop"),
    ("wheat cultivation", "crop"), ("gehu ki kheti", "crop"),
    ("rice farming", "crop"), ("fasal salah", "crop"),
    ("intercropping kaise kare", "crop"),
    ("is mausam mein kya ugaun", "crop"), ("crop rotation", "crop"),
    ("fasal ki jankari", "crop"), ("खेती की जानकारी", "crop"),
    ("konsi fasal lagana chahiye is baar", "crop"),

    # IRRIGATION
    ("पानी कब दें", "irrigation"), ("pani kab dena chahiye", "irrigation"),
    ("drip irrigation", "irrigation"), ("sprinkler system", "irrigation"),
    ("sinchai kab kare", "irrigation"), ("water management", "irrigation"),
    ("bore well", "irrigation"), ("canal irrigation", "irrigation"),
    ("pani ki kami", "irrigation"), ("irrigation schedule", "irrigation"),
    ("kitna pani dena chahiye", "irrigation"),
    ("micro irrigation", "irrigation"), ("सिंचाई", "irrigation"),
    ("pani kab dena chahiye gehu mein", "irrigation"),

    # SEED
    ("बीज कौन सा लगाऊं", "seed"), ("beej ki jankari", "seed"),
    ("hybrid seed", "seed"), ("certified seed", "seed"),
    ("seed treatment", "seed"), ("beej upchar", "seed"),
    ("seed rate for wheat", "seed"), ("konsa beej achha hai", "seed"),
    ("variety selection", "seed"), ("f1 hybrid seed", "seed"),
    ("beej kahan milega", "seed"), ("बीज उपचार", "seed"),
    ("beej kahan se kharidu", "seed"),

    # MACHINERY
    ("ट्रैक्टर की जानकारी", "machinery"),
    ("tractor kharidna hai", "machinery"),
    ("rotavator kya hai", "machinery"), ("sprayer machine", "machinery"),
    ("combine harvester", "machinery"), ("seed drill", "machinery"),
    ("agri drone", "machinery"), ("machinery subsidy", "machinery"),
    ("tractor loan", "machinery"), ("power tiller", "machinery"),
    ("कृषि यंत्र", "machinery"), ("yantra anudan", "machinery"),
    ("tractor ki jankari chahiye", "machinery"),

    # EMERGENCY
    ("Help! My crop is dying", "emergency"),
    ("madad karo", "emergency"), ("bachao", "emergency"),
    ("urgent help needed", "emergency"),
    ("meri fasal mar rahi hai madad karo", "emergency"),
    ("flood damage to crop", "emergency"),
    ("hail damage", "emergency"), ("SOS", "emergency"),
    ("turant madad chahiye", "emergency"),

    # GENERAL
    ("What can you do", "general"), ("kya kar sakte ho", "general"),
    ("Pragati AI kya hai", "general"), ("how does this work", "general"),
    ("mujhe jankari chahiye", "general"), ("guide me", "general"),
    ("features kya hain", "general"),
]


def run_tests(verbose: bool = True) -> dict:
    from intent_engine.auto_rebuild import ensure_model_is_current
    ensure_model_is_current()
    from intent_engine.predictor import get_predictor
    predictor = get_predictor()

    results = {"total": len(TEST_CASES), "correct": 0, "wrong": 0,
               "per_intent": {}, "failures": []}

    intents = sorted(set(e for _, e in TEST_CASES))
    for i in intents:
        results["per_intent"][i] = {"tp": 0, "fp": 0, "fn": 0, "total": 0}

    for text, expected in TEST_CASES:
        pred = predictor.predict(text)
        got  = pred.intent
        results["per_intent"][expected]["total"] += 1
        if got == expected:
            results["correct"] += 1
            results["per_intent"][expected]["tp"] += 1
        else:
            results["wrong"] += 1
            results["per_intent"][expected]["fn"] += 1
            if got in results["per_intent"]:
                results["per_intent"][got]["fp"] += 1
            results["failures"].append(
                {"text": text, "expected": expected,
                 "got": got, "conf": round(pred.confidence, 3)})
            if verbose:
                print(f"  FAIL | exp={expected:<14} got={got:<14} "
                      f"conf={pred.confidence:.3f} | '{text}'")

    results["accuracy"] = round(results["correct"] / results["total"], 4)
    for intent, d in results["per_intent"].items():
        tp, fp, fn = d["tp"], d["fp"], d["fn"]
        p  = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        r  = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2*p*r/(p+r) if (p+r) > 0 else 0.0
        d.update(precision=round(p,4), recall=round(r,4), f1=round(f1,4))
    return results


def print_report(r: dict) -> None:
    print("\n" + "="*68)
    print("  AKP Intent Engine — Full Pipeline Test Report")
    print("="*68)
    print(f"  Total={r['total']}  Correct={r['correct']}  "
          f"Wrong={r['wrong']}  Accuracy={r['accuracy']*100:.1f}%")
    print(f"\n  {'Intent':<16} {'N':>4} {'Prec':>7} {'Rec':>7} {'F1':>7}")
    print("  " + "-"*46)
    for intent, d in sorted(r["per_intent"].items()):
        print(f"  {intent:<16} {d['total']:>4} "
              f"{d['precision']:>7.4f} {d['recall']:>7.4f} {d['f1']:>7.4f}")
    if r["failures"]:
        print(f"\n  Failures ({len(r['failures'])}):")
        for f in r["failures"]:
            print(f"    exp={f['expected']:<14} got={f['got']:<14} "
                  f"conf={f['conf']:.3f} | '{f['text']}'")
    print("="*68 + "\n")


# pytest hooks
def test_accuracy():
    r = run_tests(verbose=False)
    print_report(r)
    assert r["accuracy"] >= 0.85, f"Accuracy {r['accuracy']*100:.1f}% < 85%"

def test_no_unknown():
    from intent_engine.predictor import get_predictor
    p = get_predictor()
    for text, _ in TEST_CASES:
        assert p.predict(text).intent != "unknown", f"unknown for '{text}'"

def test_market():
    from intent_engine.predictor import get_predictor
    p = get_predictor()
    for t in ["मंडी भाव","mandi bhav","bhav","rate","मंडी","wheat price today"]:
        assert p.predict(t).intent == "market", f"market failed for '{t}'"

def test_greeting():
    from intent_engine.predictor import get_predictor
    p = get_predictor()
    for t in ["Namaste","Hello","नमस्ते","Ram Ram sa","Khamma ghani"]:
        assert p.predict(t).intent == "greeting", f"greeting failed for '{t}'"

def test_pest():
    from intent_engine.predictor import get_predictor
    p = get_predictor()
    for t in ["कीड़े लग गए","pest attack","tiddi dal","aphid on crop"]:
        assert p.predict(t).intent == "pest", f"pest failed for '{t}'"


if __name__ == "__main__":
    print("\nRunning full pipeline tests ...")
    r = run_tests(verbose=True)
    print_report(r)
    sys.exit(0 if r["accuracy"] >= 0.85 else 1)
