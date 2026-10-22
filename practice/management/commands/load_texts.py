import json
from pathlib import Path

from django.core.management.base import BaseCommand

from practice.models import TextSample

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "texts.json"


class Command(BaseCommand):
    help = "practice/data/texts.json dagi matnlarni bazaga yuklaydi (yangilaydi)."

    def handle(self, *args, **options):
        items = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        created = updated = 0
        for item in items:
            _, is_new = TextSample.objects.update_or_create(
                lang=item["lang"],
                title=item["title"],
                defaults={"category": item["category"], "body": item["body"]},
            )
            created += is_new
            updated += not is_new
        self.stdout.write(self.style.SUCCESS(f"Yaratildi: {created}, yangilandi: {updated}"))
