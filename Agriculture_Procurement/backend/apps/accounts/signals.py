from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import FarmerProfile, User


@receiver(post_save, sender=User)
def ensure_farmer_profile(sender, instance, **kwargs):
    if instance.role == User.Role.FARMER:
        FarmerProfile.objects.get_or_create(user=instance)
