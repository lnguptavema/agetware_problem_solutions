def format_indian_currency(number):
    # Spliting into integer and decimal parts
    parts = str(number).split(".")
    integer_part = parts[0]   #accessing integer_part
    decimal_part = parts[1] if len(parts) > 1 else ""

    # First group: last 3 digits
    last_three = integer_part[-3:]
    remaining = integer_part[:-3]

    # Add commas after every 2 digits in the remaining part
    if remaining != "":
        remaining = ",".join([remaining[max(i - 2, 0):i] for i in range(len(remaining), 0, -2)][::-1])
        formatted = remaining + "," + last_three
    else:
        formatted = last_three

    # Adding decimal part if exists
    if decimal_part:
        return formatted + "." + decimal_part
    else:
        return formatted
print(format_indian_currency(123456.7891))  # Output: 1,23,456.7891
print(format_indian_currency(10000000))     # Output: 1,00,00,000