from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_payment_receipt_pdf(payment) -> bytes:
    """Render verified settlement proof; callers must enforce settled-only access."""

    if payment.status != payment.Status.SETTLED or not hasattr(payment, "settlement_receipt"):
        raise ValueError("Payment proof can be generated only for a settled payment.")

    transaction = payment.transaction
    receipt = payment.settlement_receipt
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"DAPP settlement proof {receipt.receipt_number}",
        author="DAPP",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "PaymentTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=19,
        leading=23, textColor=colors.HexColor("#0b3b35"), alignment=TA_CENTER, spaceAfter=4 * mm,
    )
    subtitle_style = ParagraphStyle(
        "PaymentSubtitle", parent=styles["Normal"], fontSize=9, leading=13,
        textColor=colors.HexColor("#4b635f"), alignment=TA_CENTER,
    )
    status_style = ParagraphStyle(
        "PaymentStatus", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13,
        leading=17, textColor=colors.HexColor("#126b4d"), alignment=TA_CENTER,
        backColor=colors.HexColor("#e9f8f0"), borderColor=colors.HexColor("#94d2b8"),
        borderWidth=0.7, borderPadding=9, spaceBefore=5 * mm, spaceAfter=5 * mm,
    )
    section_style = ParagraphStyle(
        "PaymentSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10,
        leading=13, textColor=colors.HexColor("#0b3b35"), spaceBefore=5 * mm, spaceAfter=2 * mm,
    )
    body_style = ParagraphStyle(
        "PaymentBody", parent=styles["BodyText"], fontSize=9, leading=13,
        textColor=colors.HexColor("#172522"),
    )
    note_style = ParagraphStyle(
        "PaymentNote", parent=body_style, fontSize=8.5, leading=12,
        textColor=colors.HexColor("#23443e"), backColor=colors.HexColor("#f2f7f5"),
        borderColor=colors.HexColor("#cfdbd8"), borderWidth=0.5, borderPadding=7,
    )

    farmer_name = transaction.farmer.get_full_name() or transaction.farmer.email
    farmer_code = transaction.farmer.farmer_profile.farmer_code
    settled_at = timezone.localtime(payment.settled_at).strftime("%d %b %Y, %I:%M %p")
    issued_at = timezone.localtime(receipt.issued_at).strftime("%d %b %Y, %I:%M %p")

    def paragraph(value):
        return Paragraph(escape(str(value)), body_style)

    def rows(items):
        return [[paragraph(label), paragraph(value)] for label, value in items]

    story = [
        Paragraph("DAPP", title_style),
        Paragraph("Digital Agricultural Procurement Platform", subtitle_style),
        Paragraph("Payment settlement proof", subtitle_style),
        Paragraph("SETTLED - VERIFIED", status_style),
    ]
    identity = Table(
        rows([
            ("Settlement receipt", receipt.receipt_number),
            ("Payment number", payment.payment_number),
            ("Bank reference / UTR", payment.bank_reference),
            ("Verification code", receipt.verification_code),
            ("Settled on", settled_at),
            ("Proof issued on", issued_at),
        ]),
        colWidths=[48 * mm, 102 * mm],
    )
    identity.setStyle(_table_style())
    story.extend([identity, Paragraph("Beneficiary and procurement", section_style)])

    procurement = Table(
        rows([
            ("Farmer", farmer_name),
            ("Farmer code", farmer_code),
            ("Beneficiary", payment.beneficiary_reference),
            ("Procurement transaction", transaction.transaction_number),
            ("Procurement receipt", transaction.receipt.receipt_number),
            ("Request", transaction.request.request_number),
            ("Centre", f"{transaction.procurement_center.code} - {transaction.procurement_center.name}"),
            ("Crop", f"{transaction.farmer_crop.crop.code} - {transaction.farmer_crop.crop.name}"),
        ]),
        colWidths=[48 * mm, 102 * mm],
    )
    procurement.setStyle(_table_style())
    story.extend([procurement, Paragraph("Settlement value", section_style)])

    value = Table(
        [
            [paragraph("Accepted quantity"), paragraph("Payment method"), paragraph("Amount settled")],
            [
                paragraph(f"{transaction.accepted_quantity_kg} kg"),
                paragraph(payment.get_method_display()),
                paragraph(f"INR {payment.amount}"),
            ],
        ],
        colWidths=[50 * mm, 50 * mm, 50 * mm],
    )
    value.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#cfdbd8")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf5f2")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([
        value,
        Spacer(1, 7 * mm),
        Paragraph(
            "This document is proof that the payment linked to the named procurement transaction "
            "was reconciled as settled in DAPP. The bank reference is unique in the DAPP ledger.",
            note_style,
        ),
        Spacer(1, 5 * mm),
        Paragraph(
            "Generated from DAPP's transaction-linked, append-only payment event history.",
            subtitle_style,
        ),
    ])
    document.build(story)
    return output.getvalue()


def _table_style() -> TableStyle:
    return TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#cfdbd8")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf5f2")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])
