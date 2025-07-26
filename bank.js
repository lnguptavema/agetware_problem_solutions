const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const databasePath = path.join(__dirname, 'app.db')

const app = express()

app.use(express.json())

let database = null

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

// api1 new loan api
app.post('/api/v1/loans', async (request, response) => {
  try {
    const {customer_id, loan_amount, loan_period_years, interest_rate_yearly} =
      request.body

    if (
      !customer_id ||
      loan_amount <= 0 ||
      loan_period_years <= 0 ||
      interest_rate_yearly <= 0
    ) {
      response.status(400)
      response.send('Invalid input data')
      return
    }

    const P = loan_amount
    const N = loan_period_years
    const R = interest_rate_yearly

    const total_interest = P * N * (R / 100)
    const total_amount = P + total_interest
    const monthly_emi = total_amount / (N * 12)

    const loanId = `LOAN_${Date.now()}`

    const insertQuery = `
      INSERT INTO Customers (
        customer_id, loan_amount, loan_period_years,
        interest_rate_yearly
      ) VALUES (
        '${customer_id}', ${loan_amount}, ${loan_period_years}, ${interest_rate_yearly}
      );`

    await database.run(insertQuery)

    response.status(201).send({
      loan_id: loanId,
      customer_id,
      total_amount_payable: parseFloat(total_amount.toFixed(2)),
      monthly_emi: parseFloat(monthly_emi.toFixed(2)),
    })
  } catch (e) {
    console.error(e)
    response.status(400).send('Invalid Input data')
  }
})

//api2 Recording payment of loan
const {v4: uuidv4} = require('uuid')

app.post('/loans/:loan_id/payments', async (req, res) => {
  try {
    const {loan_id} = req.params
    const {amount, payment_type} = req.body

    if (!amount || amount <= 0 || !['EMI', 'LUMP_SUM'].includes(payment_type)) {
      return res.status(400).send('Invalid payment data')
    }

    // Geting loan
    const loan = await database.get(`SELECT * FROM Loans WHERE loan_id = ?`, [
      loan_id,
    ])
    if (!loan) {
      return res.status(404).send('Loan not found')
    }

    // Sum paid
    const payments = await database.all(
      `SELECT amount FROM Payments WHERE loan_id = ?`,
      [loan_id],
    )
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

    const outstanding_before = loan.total_amount - totalPaid
    if (outstanding_before <= 0) {
      return res.status(200).json({
        payment_id: null,
        loan_id,
        message: 'Loan fully paid.',
        remaining_balance: 0,
        emis_left: 0,
      })
    }

    //remaining balance
    let remaining_balance = outstanding_before - amount
    if (remaining_balance < 0) remaining_balance = 0

    // EMI amt
    const monthly_emi = loan.monthly_emi

    // Calculate emis_left — lump sum reduces number of EMIs
    let emis_left = Math.ceil(remaining_balance / monthly_emi)
    if (payment_type === 'LUMP_SUM') {
      emis_left = Math.max(0, emis_left)
    }

    // Insert payment record
    const payment_id = uuidv4()
    await database.run(
      `INSERT INTO Payments (payment_id, loan_id, amount, payment_type) VALUES (?, ?, ?, ?)`,
      [payment_id, loan_id, amount, payment_type],
    )

    // Updating loan status if full paid
    if (remaining_balance === 0) {
      await database.run(
        `UPDATE Loans SET status = 'PAID_OFF' WHERE loan_id = ?`,
        [loan_id],
      )
    }

    res.status(200).json({
      payment_id,
      loan_id,
      message: 'Payment recorded successfully.',
      remaining_balance: parseFloat(remaining_balance.toFixed(2)),
      emis_left,
    })
  } catch (e) {
    console.error(e)
    res.status(500).send('Internal Server Error')
  }
})
//
//api3 loandetainls and transactions
app.get('/loans/:loan_id/ledger', async (req, res) => {
  try {
    const {loan_id} = req.params

    // Geting loan details
    const loanQuery = `
      SELECT 
        loan_id, customer_id, principal_amount, total_amount, 
        monthly_emi, status 
      FROM Loans WHERE loan_id = ?
    `
    const loan = await database.get(loanQuery, [loan_id])

    if (!loan) {
      return res.status(404).send('Loan not found')
    }

    // Get payments for loan
    const paymentsQuery = `
      SELECT 
        payment_id AS transaction_id,
      paid_at AS date,
        amount,
        payment_type AS type
      FROM Payments
      WHERE loan_id = ?
      ORDER BY paid_at ASC
    `
    const transactions = await database.all(paymentsQuery, [loan_id])

    // Calculateing totals
    const amount_paid = transactions.reduce((sum, t) => sum + t.amount, 0)
    const balance_amount = Math.max(loan.total_amount - amount_paid, 0)
    const emis_left = Math.ceil(balance_amount / loan.monthly_emi)

    res.status(200).json({
      loan_id: loan.loan_id,
      customer_id: loan.customer_id,
      principal: parseFloat(loan.principal_amount.toFixed(2)),
      total_amount: parseFloat(loan.total_amount.toFixed(2)),
      monthly_emi: parseFloat(loan.monthly_emi.toFixed(2)),
      amount_paid: parseFloat(amount_paid.toFixed(2)),
      balance_amount: parseFloat(balance_amount.toFixed(2)),
      emis_left,
      transactions,
    })
  } catch (e) {
    console.error(e)
    res.status(500).send('Internal Server Error')
  }
})

//api4 all loanss
app.get('/customers/:customer_id/overview', async (req, res) => {
  const {customer_id} = req.params

  // Get all loans for customer
  const loansQuery = `
    SELECT 
      loan_id, principal_amount, total_amount, interest_rate,
      monthly_emi
    FROM Loans
    WHERE customer_id = ?
  `
  const loans = await database.all(loansQuery, [customer_id])

  if (!loans || loans.length === 0) {
    return res.status(404).send('No loans found for this customer')
  }

  // For each loan, get total payments and calculateing remaining EMIs
  const loanSummaries = await Promise.all(
    loans.map(async loan => {
      const paymentsQuery = `
        SELECT SUM(amount) AS amount_paid
        FROM Payments
        WHERE loan_id = ?
      `
      const paymentResult = await database.get(paymentsQuery, [loan.loan_id])
      const amount_paid = paymentResult?.amount_paid || 0
      const balance = loan.total_amount - amount_paid
      const emis_left = Math.ceil(balance / loan.monthly_emi)
      const total_interest = loan.total_amount - loan.principal_amount

      return {
        loan_id: loan.loan_id,
        principal: parseFloat(loan.principal_amount.toFixed(2)),
        total_amount: parseFloat(loan.total_amount.toFixed(2)),
        total_interest: parseFloat(total_interest.toFixed(2)),
        emi_amount: parseFloat(loan.monthly_emi.toFixed(2)),
        amount_paid: parseFloat(amount_paid.toFixed(2)),
        emis_left,
      }
    }),
  )
  res.status(200).json({
    customer_id,
    total_loans: loanSummaries.length,
    loans: loanSummaries,
  })
})

module.exports = app
