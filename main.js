import express from 'express';
const router = express.Router();
import pool from './db.js';

router.get('/api/cashflow', async (req, res) => {
  const { companyid, fromDate, toDate } = req.query;

  try {
    const result = await pool.query(`
      WITH cash_movements AS (
        SELECT
          date,
          account,
          debit,
          credit,
          bankaccount,
          companyid,
          CASE
            WHEN account ILIKE '%Capital%' OR account ILIKE '%Loan%' THEN 'Financing'
            WHEN account ILIKE '%Inventory%' THEN 'Investing'
            ELSE 'Operating'
          END AS cashflow_category
        FROM AccountingLedgerEntry
        WHERE date BETWEEN $1 AND $2 AND companyid = $3
          AND (debit > 0 OR credit > 0)
      )
      SELECT
        cashflow_category,
        SUM(debit) AS cash_inflow,
        SUM(credit) AS cash_outflow,
        SUM(debit - credit) AS net_cash_flow
      FROM cash_movements
      GROUP BY cashflow_category
    `, [fromDate, toDate, companyid]);

    let totalInflow = 0, totalOutflow = 0;
    result.rows.forEach(row => {
      totalInflow += parseFloat(row.cash_inflow || 0);
      totalOutflow += parseFloat(row.cash_outflow || 0);
    });

    const netChange = totalInflow - totalOutflow;
    const closingCashBalance = 22500;
    res.json({
      cashFlows: result.rows,
      summary: {
        totalInflow,
        totalOutflow,
        netChange,
        closingCashBalance
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/api/bank-reconciliation', async (req, res) => {
  const { companyid, bankaccount } = req.query;

  try {
    const unreconciled = await pool.query(`
      SELECT
        reference,
        date,
        account,
        debit,
        credit,
        reconciled,
        note,
        bankaccount
      FROM AccountingLedgerEntry
      WHERE companyid = $1
        AND LOWER(bankaccount) = LOWER($2)
        AND reconciled = FALSE
    `, [companyid, bankaccount]);

    const ledgerBalance = 22500;
    const bankStatementBalance = 19000;

    let totalReconcilingItems = 0;
    for (const row of unreconciled.rows) {
      totalReconcilingItems += (parseFloat(row.debit || 0) - parseFloat(row.credit || 0));
    }

    const adjustedBankBalance = bankStatementBalance - totalReconcilingItems;

    res.json({
      ledgerBalance,
      bankStatementBalance,
      unreconciledTransactions: unreconciled.rows,
      adjustedBankBalance,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
