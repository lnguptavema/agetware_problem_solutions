def is_more_than_half_inside(inner, outer):
    inner_left, inner_right = inner
    outer_left, outer_right = outer
    inner_width = inner_right - inner_left
    overlap = max(0, min(inner_right, outer_right) - max(inner_left, outer_left))
    return overlap > (inner_width / 2)

def combine_element(elem1, elem2):
    # Keep the position of the first one (assumed earlier in the sorted list)
    combined_values = elem1["values"] + elem2["values"]
    return {
        "positions": elem1["positions"],
        "values": combined_values
    }

def combine_lists(list1, list2):
    combined = list1 + list2
    combined.sort(key=lambda x: x["positions"][0])  # Sort by left_position

    result = []
    skip_next = False

    for i in range(len(combined)):
        if skip_next:
            skip_next = False
            continue

        current = combined[i]
        if i + 1 < len(combined):
            next_elem = combined[i + 1]
            if is_more_than_half_inside(next_elem["positions"], current["positions"]):
                merged = combine_element(current, next_elem)
                result.append(merged)
                skip_next = True
            else:
                result.append(current)
        else:
            result.append(current)

    return result
list1 = [
    {"positions": [0, 10], "values": ["a"]},
    {"positions": [20, 30], "values": ["b"]}
]

list2 = [
    {"positions": [5, 9], "values": ["x"]},
    {"positions": [25, 28], "values": ["y"]}
]

output = combine_lists(list1, list2)
print(output)