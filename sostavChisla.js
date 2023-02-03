function sostavChisla(massivChisel, chislo) {
    function findCombs(numbers, sum, index, result, curComb) {
        if (sum == 0) {
            result.push([...curComb])
            return
        } else if (sum < 0 || index == massivChisel.length) {
            return
        } else {
            curComb.push(numbers[index])
            findCombs(numbers, sum - numbers[index], index + 1, result, curComb)
            curComb.pop()
            findCombs(numbers, sum, index + 1, result, curComb)
        }
    }

    const result = []
    const curComb = []
    let index = 0
    findCombs(massivChisel, chislo, index, result, curComb)

    return result;
}