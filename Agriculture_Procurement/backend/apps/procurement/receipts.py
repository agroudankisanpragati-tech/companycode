from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_procurement_receipt_pdf(transaction) -> bytes:
    """Render the immutable procurement record as a compact, downloadable PDF."""

    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"DAPP procurement receipt {transaction.receipt.receipt_number}",
        author="DAPP",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DappReceiptTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=23,
        textColor=colors.HexColor("#0b3b35"),
        alignment=TA_CENTER,
        spaceAfter=4 * mm,
    )
    subtitle_style = ParagraphStyle(
        "DappReceiptSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#4b635f"),
        alignment=TA_CENTER,
    )
    section_style = ParagraphStyle(
        "DappReceiptSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#0b3b35"),
        spaceBefore=5 * mm,
        spaceAfter=2 * mm,
    )
    body_style = ParagraphStyle(
        "DappReceiptBody",
        parent=styles["BodyText"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#172522"),
    )
    note_style = ParagraphStyle(
        "DappReceiptNote",
        parent=body_style,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#5e4c1b"),
        backColor=colors.HexColor("#fff8df"),
        borderColor=colors.HexColor("#eed78b"),
        borderWidth=0.5,
        borderPadding=7,
    )

    receipt = transaction.receipt
    decision = transaction.acceptance_decision
    weighment = decision.weighment
    farmer_name = transaction.farmer.get_full_name() or transaction.farmer.email
    farmer_code = transaction.farmer.farmer_profile.farmer_code
    procured_at = timezone.localtime(transaction.procured_at).strftime("%d %b %Y, %I:%M %p")

    def paragraph(value):
        return Paragraph(escape(str(value)), body_style)

    def rows(items):
        return [[paragraph(label), paragraph(value)] for label, value in items]

    story = [
        Paragraph("DAPP", title_style),
        Paragraph("Digital Agricultural Procurement Platform", subtitle_style),
        Paragraph("Procurement receipt", subtitle_style),
        Spacer(1, 5 * mm),
    ]

    identity_table = Table(
        rows(
            [
                ("Receipt number", receipt.receipt_number),
                ("Transaction number", transaction.transaction_number),
                ("Recorded on", procured_at),
                ("Verification code", receipt.verification_code),
            ]
        ),
        colWidths=[45 * mm, 105 * mm],
    )
    identity_table.setStyle(_table_style(header=False))
    story.extend([identity_table, Paragraph("Farmer and appointment", section_style)])

    farmer_table = Table(
        rows(
            [
                ("Farmer", farmer_name),
                ("Farmer code", farmer_code),
                ("Request", transaction.request.request_number),
                ("Arrival token", transaction.appointment.token_code),
                ("Centre", f"{transaction.procurement_center.code} - {transaction.procurement_center.name}"),
                ("Crop", f"{transaction.farmer_crop.crop.code} - {transaction.farmer_crop.crop.name}"),
            ]
        ),
        colWidths=[45 * mm, 105 * mm],
    )
    farmer_table.setStyle(_table_style(header=False))
    story.extend([farmer_table, Paragraph("Quantity and value", section_style)])

    value_data = [
        [paragraph("Net weight"), paragraph("Accepted"), paragraph("Rejected")],
        [
            paragraph(f"{weighment.net_weight_kg} kg"),
            paragraph(f"{transaction.accepted_quantity_kg} kg"),
            paragraph(f"{decision.rejected_quantity_kg} kg"),
        ],
        [paragraph("Rate"), paragraph("Amount payable"), paragraph("Payment status")],
        [
            paragraph(f"INR {transaction.rate_per_kg} / kg"),
            paragraph(f"INR {transaction.total_amount}"),
            paragraph("Pending"),
        ],
    ]
    value_table = Table(value_data, colWidths=[50 * mm, 50 * mm, 50 * mm])
    value_table.setStyle(_table_style(header=True))
    story.extend([value_table])

    if transaction.acceptance_notes:
        story.extend(
            [
                Paragraph("Decision notes", section_style),
                Paragraph(escape(transaction.acceptance_notes), body_style),
            ]
        )

    story.extend(
        [
            Spacer(1, 7 * mm),
            Paragraph(
                "This receipt confirms the recorded physical procurement transaction. "
                "It is not proof of payment. Use the separate DAPP payment ledger and "
                "settlement proof to verify payment status.",
                note_style,
            ),
            Spacer(1, 5 * mm),
            Paragraph(
                "Generated from DAPP's immutable check-in, inspection, weighment, and "
                "acceptance records.",
                subtitle_style,
            ),
        ]
    )
    document.build(story)
    return output.getvalue()


def _table_style(*, header: bool) -> TableStyle:
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#cfdbd8")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf5f2")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf5f2")),
                ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#edf5f2")),
            ]
        )
    return TableStyle(commands)
