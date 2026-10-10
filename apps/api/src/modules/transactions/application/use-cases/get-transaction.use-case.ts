import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { fromResult, Result } from '../../../../shared/result/result';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from '../ports/transaction-repository.port';
import { TransactionReconciler } from '../services/transaction-reconciler';
import { toTransactionView, TransactionView } from './transaction.views';

@Injectable()
export class GetTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(TransactionReconciler) private readonly reconciler: TransactionReconciler,
  ) {}

  /**
   * Railway: find by id → reconcile with the gateway while `PENDING` → view.
   * Errors: TRANSACTION_NOT_FOUND, PERSISTENCE_ERROR.
   */
  execute(id: string): Promise<Result<TransactionView, DomainError>> {
    return fromResult(this.transactions.findById(id))
      .andThen((transaction) => this.reconciler.reconcile(transaction))
      .map(toTransactionView)
      .toPromise();
  }
}
