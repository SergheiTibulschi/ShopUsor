import { Injectable } from '@nestjs/common';
import { ScraperService } from '../scraper/scraper.service';
import { ReceiptUrlDTO } from './dto/receipt-url.dto';
import { ScrapeMe } from '../scraper/helpers';
import { AssistantService } from '../assistant/assistant.service';
import { Supabase } from '../supabase';
import {
  ReceiptItemInsert,
  ReceiptVarDetailsInsert,
} from '../../types/receipts';

@Injectable()
export class ReceiptsService {
  constructor(
    private scrapperService: ScraperService,
    private assistantService: AssistantService,
    private supabase: Supabase,
  ) {}

  async create(createReceiptDto: ReceiptUrlDTO) {
    const { data: existingReceipt, error: selectError } = await this.supabase
      .getClient()
      .from('receipts')
      .select('receipt_id')
      .eq('receipt_id', createReceiptDto.url)
      .single();

    if (selectError) {
      throw new Error(`Failed to select receipt: ${selectError.message}`);
    } else if (existingReceipt) {
      throw new Error('Receipt already exists');
    }

    const html = await this.scrapperService.getHtml(
      new ScrapeMe(createReceiptDto.url, '#newFormTest'),
    );
    const receipt = await this.assistantService.parseHtml(html);

    const { error: receiptError } = await this.supabase
      .getClient()
      .from('receipts')
      .insert([
        {
          company_name: receipt.companyName,
          fiscal_code: receipt.fiscalCode,
          address: receipt.address,
          registration_number: receipt.registrationNumber,
          total_amount: receipt.total.amount,
          payment_method: receipt.total.paymentMethod,
          date: receipt.transactionDetails.date,
          time: receipt.transactionDetails.time,
          fiscal_receipt_number: receipt.transactionDetails.fiscalReceiptNumber,
          manufacturing_number: receipt.transactionDetails.manufacturingNumber,
          receipt_id: createReceiptDto.url,
        },
      ]);

    if (receiptError) {
      throw new Error(`Failed to insert receipt: ${receiptError.message}`);
    }

    const items: ReceiptItemInsert[] = receipt.items.map((item) => ({
      receipt_id: createReceiptDto.url, // Assuming receiptData contains the inserted receipt with ID
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      amount: item.amount,
    }));

    const { error: itemsError } = await this.supabase
      .getClient()
      .from('receipt_items')
      .insert(items);

    if (itemsError) {
      throw new Error(`Failed to insert receipt items: ${itemsError.message}`);
    }

    const vatDetails: ReceiptVarDetailsInsert[] = receipt.total.vat.map(
      (vatDetail) => ({
        receipt_id: createReceiptDto.url, // Use inserted receipt ID
        vat_percentage: vatDetail.percentage,
        vat_amount: vatDetail.amount,
      }),
    );

    const { error: vatError } = await this.supabase
      .getClient()
      .from('vat_details')
      .insert(vatDetails);

    if (vatError) {
      throw new Error(`Failed to insert VAT details: ${vatError.message}`);
    }

    return receipt;
  }

  async findAll() {
    return `This action returns all receipts`;
  }

  findOne(id: number) {
    return `This action returns a #${id} receipt`;
  }

  remove(id: number) {
    return `This action removes a #${id} receipt`;
  }
}
