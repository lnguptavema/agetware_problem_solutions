def minimize_loss(prices):
    n = len(prices)
    min_loss = float('inf')
    buy_year = sell_year = -1

    for i in range(n):
        for j in range(i + 1, n):
            if prices[j] < prices[i]:
                loss = prices[i] - prices[j]
                if loss < min_loss:
                    min_loss = loss
                    buy_year = i + 1
                    sell_year = j + 1

    if buy_year == -1:
        print("No valid buy-sell pair found (no loss possible).")
    else:
        print("Buy in year {} at price {}".format(buy_year, prices[buy_year - 1]))
        print("Sell in year {} at price {}".format(sell_year, prices[sell_year - 1]))
        print("Minimum loss: {}".format(min_loss))

# Take prices from user input which is separated by space
input_string = input() 
#input 20 15 7 2 13
prices = list(map(int, input_string.strip().split()))
# Run the function
minimize_loss(prices)
#output
# Buy in year 2 at price 15
# Sell in year 5 at price 13
# Minimum loss: 2