from django.shortcuts import render, get_object_or_404
from lms.models import UserCertificate
from django.utils.translation import gettext_lazy as _

def verify_certificate(request, serial_number):
    """
    Public view to verify a certificate's authenticity.
    """
    certificate = UserCertificate.objects.filter(serial_number=serial_number).select_related('user', 'course', 'user__student_profile').first()
    
    context = {
        'is_valid': certificate is not None,
        'certificate': certificate,
        'title': _("Sertifikatni tekshirish")
    }
    
    return render(request, 'lms/verify_certificate.html', context)
