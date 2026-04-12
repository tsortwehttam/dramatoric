# Functions Reference

Functions are small bits of code you can use inside expressions. They let you do simple math, compare values, or reshape text when you need a little extra control.

Coding in Dramatoric inspired by programming languages like JavaScript — but it is much, much simpler, kept small and focused. You write short snippets of code using numbers, strings (text inside quotes), and variables (saved values). Like any coding (programming) language, symbols have to be typed exactly or the engine cannot understand your intent.

A function is just like the 'functions' you learned about in math class — a kind of reusable tool that contains some math or logic. Like `toUpperCase('hello')` (converts the text string to uppercase letters). The part inside the parentheses is the input. The function returns a new value that you can use right away.

In code there are different types of values, but you'll mainly deal with numbers and strings. Numbers are plain values like `1`, `2.5`, or `-3`. Strings are text like `"hello"` or `"a quiet room"`. (Note: If you forget quotes around text, it will be treated as a variable name instead of a string, so make sure to quote your text strings!)

The reference below shows each method with a short example and a one-line description. You do not need to learn everything at once. Treat this as a menu you can dip into when you want to do something specific.
## Array Functions
| Example | Returns |
| --- | --- |
| `arrayArrayDrop([1,2,3,4], 2) //=> [3,4]` | The array with the first n elements removed. |
| `arrayArrayNth([1,2,3], 1) //=> 2` | The element at index n, or null if out of bounds. |
| `arrayArrayTake([1,2,3,4], 2) //=> [1,2]` | The first n elements of the array. |
| `arrayCompact([1,0,2,null,3]) //=> [1,2,3]` | The array with falsy values removed. |
| `arrayConcat([1,2], [3]) //=> [1,2,3]` | A concatenated array. |
| `arrayContains([1,2,3], 2) //=> true` | True if the array contains the value. |
| `arrayCount([1,2,2,3], 2) //=> 2` | The number of times the value appears in the array. |
| `arrayCreate(1, 2, 3) //=> [1, 2, 3]` | Created value. |
| `arrayDifference([1,2,3], [2,3,4]) //=> [1]` | Elements in the first array that are not in the second. |
| `arrayEntries(["a", "b"]) //=> [[0,"a"],[1,"b"]]` | Array entries as [index, value] pairs. |
| `arrayFirst([1,2,3]) //=> 1` | The first element of the array, or null if empty. |
| `arrayFlat([1,[2,[3]]], 2) //=> [1,2,3]` | A flattened array to the given depth. |
| `arrayFlatten([1,[2,3],4]) //=> [1,2,3,4]` | The array flattened one level deep. |
| `arrayFlattenDeep([1,[2,[3]]], 2) //=> [1,2,3]` | The array flattened to the specified depth. |
| `arrayIncludes([1,2,3], 2) //=> true` | True if the array includes the search value. |
| `arrayIndexOf([1,2,3], 2) //=> 1` | The first index of the search value, or -1. |
| `arrayIntersection([1,2,3], [2,3,4]) //=> [2,3]` | The intersection of two arrays. |
| `arrayJoin(["a","b"], "-") //=> "a-b"` | Result. |
| `arrayKeys(["a","b"]) //=> [0,1]` | The array indices. |
| `arrayLast([1,2,3]) //=> 3` | The last element of the array, or null if empty. |
| `arrayLastIndexOf([1,2,1], 1) //=> 2` | The last index of the search value, or -1. |
| `arrayLength([1,2,3]) //=> 3` | The array length. |
| `arrayMean([1,2,3]) //=> 2` | The arithmetic mean of numeric values in the array. |
| `arrayMedian([1,2,3]) //=> 2` | The median value of the array. |
| `arraySlice([1,2,3,4], 1, 3) //=> [2,3]` | A slice of the array. |
| `arraySortDesc([3,1,2]) //=> [3,2,1]` | A copy of the array sorted in descending order. |
| `arraySum([1,2,3]) //=> 6` | The sum of numeric values in the array. |
| `arraySumBy([[1,2],[3,4]], 1) //=> 6` | The sum of values at the specified index or property. |
| `arrayUnion([1,2], [2,3]) //=> [1,2,3]` | The union of two arrays with duplicates removed. |
| `arrayUniq([1,2,2,3]) //=> [1,2,3]` | The array with duplicate values removed. |
| `arrayValues(["a","b"]) //=> ["a","b"]` | The array values. |
| `toLocaleString([1,2,3]) //=> "1,2,3"` | The locale-aware string for the array. |
| `toReversed([1,2,3]) //=> [3,2,1]` | A reversed copy of the array. |
| `toSorted([3,1,2]) //=> [1,2,3]` | A sorted copy of the array. |
| `toSpliced([1,2,3], 1, 1, 9) //=> [1,9,3]` | A spliced copy of the array. |
| `toString([1,2,3]) //=> "1,2,3"` | The array as a string. |

## Date Functions
| Example | Returns |
| --- | --- |
| `getDate("2000-01-02T03:04:05") //=> 2` | The day of the month in local time. |
| `getDay(1735689600000) //=> 1` | The day of month from a timestamp. |
| `getDaysSince(1735603200000) //=> 1` | Days since a past timestamp. |
| `getDaysUntil(1735689600000) //=> 5` | Days until a target timestamp. |
| `getDecimalHoursToClock(2.5) //=> "2:30"` | Converted value. |
| `getFullYear("2000-01-02T03:04:05") //=> 2000` | The full year in local time. |
| `getHour(1735732800000) //=> 12` | The hour (0-23) from a timestamp. |
| `getHours("2000-01-02T03:04:05") //=> 3` | The hour (0-23) in local time. |
| `getHoursSince(1735689600000) //=> 12` | Hours since a past timestamp. |
| `getHoursUntil(1735732800000) //=> 24` | Hours until a target timestamp. |
| `getMilliseconds("2000-01-02T03:04:05.006") //=> 6` | The milliseconds (0-999) in local time. |
| `getMinute(1735734600000) //=> 30` | The minute (0-59) from a timestamp. |
| `getMinutes("2000-01-02T03:04:05") //=> 4` | The minutes (0-59) in local time. |
| `getMinutesSince(1735732800000) //=> 30` | Minutes since a past timestamp. |
| `getMinutesUntil(1735734600000) //=> 30` | Minutes until a target timestamp. |
| `getMonth(1735689600000) //=> 1` | The month (1-12) from a timestamp. |
| `getMonthName(1735689600000) //=> "January"` | The month name from a timestamp. |
| `getMsToDecimalHours(3600000) //=> 1` | Converted value. |
| `getSecond(1735734645000) //=> 45` | The second (0-59) from a timestamp. |
| `getSeconds("2000-01-02T03:04:05") //=> 5` | The seconds (0-59) in local time. |
| `getTime("2000-01-01T00:00:00Z") //=> 946684800000` | The timestamp in milliseconds. |
| `getTimezoneOffset("2000-01-01T00:00:00Z") //=> Local timezone offset` | The timezone offset in minutes. |
| `getUTCDate("2000-01-02T03:04:05Z") //=> 2` | The day of the month in UTC. |
| `getUTCDay("2000-01-02T03:04:05Z") //=> 0` | The weekday (0-6) in UTC. |
| `getUTCFullYear("2000-01-02T03:04:05Z") //=> 2000` | The full year in UTC. |
| `getUTCHours("2000-01-02T03:04:05Z") //=> 3` | The hour (0-23) in UTC. |
| `getUTCMilliseconds("2000-01-02T03:04:05.006Z") //=> 6` | The milliseconds (0-999) in UTC. |
| `getUTCMinutes("2000-01-02T03:04:05Z") //=> 4` | The minutes (0-59) in UTC. |
| `getUTCMonth("2000-01-02T03:04:05Z") //=> 0` | The month (0-11) in UTC. |
| `getUTCSeconds("2000-01-02T03:04:05Z") //=> 5` | The seconds (0-59) in UTC. |
| `getWeekday(1735689600000) //=> 3` | The weekday (0=Sunday, 6=Saturday) from a timestamp. |
| `getWeekdayName(1735689600000) //=> "Wednesday"` | The weekday name from a timestamp. |
| `getYear(1735689600000) //=> 2025` | The year from a timestamp. |
| `timeCreate(2024, 12, 25, 10, 30) //=> 1735119000000` | Created value. |
| `timeFormat(1735689600000, "yyyy-MM-dd HH:mm:ss") //=> "2025-01-01 00:00:00"` | Formatted string. |
| `timeNow() //=> 1762071908493` | The current Unix timestamp in milliseconds. |
| `toDateString("2000-01-02T03:04:05") //=> "Sun Jan 02 2000"` | A human-readable date string. |
| `toISOString("2000-01-02T03:04:05Z") //=> "2000-01-02T03:04:05.000Z"` | The ISO 8601 string. |
| `toJSON("2000-01-02T03:04:05Z") //=> "2000-01-02T03:04:05.000Z"` | The JSON date string. |
| `toLocaleDateString("2000-01-02T03:04:05Z", "en-US", { timeZone: "UTC" }) //=> "1/2/2000"` | The locale-formatted date string. |
| `toLocaleString("2000-01-02T03:04:05Z", "en-US", { timeZone: "UTC", hour12: false }) //=> "1/2/2000, 03:04:05"` | The locale-formatted date and time string. |
| `toLocaleTimeString("2000-01-02T03:04:05Z", "en-US", { timeZone: "UTC", hour12: false }) //=> "03:04:05"` | The locale-formatted time string. |
| `toString("2000-01-02T03:04:05") //=> Local timezone string` | The Date string representation. |
| `toTimeString("2000-01-02T03:04:05") //=> Local time string` | The time string representation. |
| `toUTCString("2000-01-02T03:04:05Z") //=> "Sun, 02 Jan 2000 03:04:05 GMT"` | The UTC string representation. |

## Math Functions
| Example | Returns |
| --- | --- |
| `calcAbs(-5) //=> 5` | The absolute value. |
| `calcAcos(1) //=> 0` | The arccosine in radians. |
| `calcAcosh(1) //=> 0` | The hyperbolic arccosine. |
| `calcAsin(0) //=> 0` | The arcsine in radians. |
| `calcAsinh(0) //=> 0` | The hyperbolic arcsine. |
| `calcAtan(0) //=> 0` | The arctangent in radians. |
| `calcAtan2(0, 1) //=> 0` | The arctangent of y/x. |
| `calcAtanh(0) //=> 0` | The hyperbolic arctangent. |
| `calcCbrt(27) //=> 3` | The cube root. |
| `calcCeil(3.2) //=> 4` | The smallest integer greater than or equal to value. |
| `calcClz32(1) //=> 31` | The count of leading zero bits in the 32-bit integer. |
| `calcCos(0) //=> 1` | The cosine in radians. |
| `calcCosh(0) //=> 1` | The hyperbolic cosine. |
| `calcExp(0) //=> 1` | E to the given power. |
| `calcExpm1(0) //=> 0` | E to the given power minus 1. |
| `calcFloor(3.9) //=> 3` | The largest integer less than or equal to value. |
| `calcFround(1.5) //=> 1.5` | The nearest 32-bit float representation. |
| `calcHypot(3, 4) //=> 5` | The square root of the sum of squares. |
| `calcImul(2, 3) //=> 6` | The 32-bit integer multiplication result. |
| `calcLog(1) //=> 0` | The natural logarithm. |
| `calcLog10(1000) //=> 3` | The base-10 logarithm. |
| `calcLog1p(0) //=> 0` | The natural log of 1 + value. |
| `calcLog2(8) //=> 3` | The base-2 logarithm. |
| `calcMax(1, 5, 2) //=> 5` | The maximum value from the arguments. |
| `calcMin(1, 5, 2) //=> 1` | The minimum value from the arguments. |
| `calcPow(2, 3) //=> 8` | Base raised to exp. |
| `calcRandom() //=> 0.123...` | A random number between 0 and 1. |
| `calcRound(2.5) //=> 3` | The nearest integer. |
| `calcSign(-5) //=> -1` | The sign of the number. |
| `calcSin(0) //=> 0` | The sine in radians. |
| `calcSinh(0) //=> 0` | The hyperbolic sine. |
| `calcSqrt(9) //=> 3` | The square root. |
| `calcTan(0) //=> 0` | The tangent in radians. |
| `calcTanh(0) //=> 0` | The hyperbolic tangent. |
| `calcTrunc(3.9) //=> 3` | The integer part of a number. |
| `clamp(10, 0, 5) //=> 5` | Number clamped within the given min and max range. |
| `getApproach(0, 10, 3) //=> 3` | Result. |
| `getAverage(1, 2, 3) //=> 2` | The average of the given numbers. |
| `getAvg(1, 2, 3) //=> 2` | The average of the given numbers. |
| `getCeilTo(3.14159, 2) //=> 3.15` | Result. |
| `getDecay(10, 0.1, 1) //=> 9` | Result. |
| `getDecayToward(10, 0, 0.1, 1) //=> 9` | Result. |
| `getDegToRad(180) //=> 3.141592653589793` | Converted value. |
| `getDenormalize(0.5, 0, 10) //=> 5` | Converted value. |
| `getDistance(0, 0, 3, 4) //=> 5` | The Euclidean distance between two points. |
| `getFactorial(5) //=> 120` | The factorial of a number. |
| `getFloorTo(3.14159, 2) //=> 3.14` | Result. |
| `getFract(2.5) //=> 0.5` | The fractional part of a number. |
| `getGcd(12, 18) //=> 6` | The greatest common divisor of two numbers. |
| `getInverseLerp(0, 10, 5) //=> 0.5` | The interpolation factor for a value between two bounds. |
| `getLcm(6, 8) //=> 24` | The least common multiple of two numbers. |
| `getLerp(0, 10, 0.5) //=> 5` | Result. |
| `getManhattan(0, 0, 3, 4) //=> 7` | The Manhattan distance between two points. |
| `getMoveToward(0, 10, 3) //=> 3` | Result. |
| `getNCr(5, 2) //=> 10` | The number of combinations (n choose r). |
| `getNormalize(5, 0, 10) //=> 0.5` | Result. |
| `getNPr(5, 2) //=> 20` | The number of permutations (n permute r). |
| `getOscSawtooth(0) //=> -1` | Generated value. |
| `getOscSine(0) //=> 0` | Generated value. |
| `getOscSquare(0) //=> 1` | Generated value. |
| `getOscTriangle(0) //=> -1` | Generated value. |
| `getPingPong(7, 5) //=> 3` | Created value. |
| `getQuantize(5.3, 0.5) //=> 5.5` | Result. |
| `getRadToDeg(3.141592653589793) //=> 180` | Converted value. |
| `getRepeat(7, 5) //=> 2` | Result. |
| `getRoundTo(3.14159, 2) //=> 3.14` | Result. |
| `getSmoothstep(0, 1, 0.5) //=> 0.5` | Result. |
| `getStandardDeviation(1, 2, 3, 4) //=> 1.118033988749895` | The standard deviation of the given numbers. |
| `getStdDev(1, 2, 3, 4) //=> 1.118033988749895` | The standard deviation of the given numbers. |
| `getStep(0.5, 0.3) //=> 0` | 0 if x < edge, otherwise 1. |
| `getVariance(1, 2, 3) //=> 0.6666666666666666` | The variance of the given numbers. |
| `isPrime(7) //=> true` | True if the number is prime. |
| `numDecr(5, 2) //=> 3` | Result. |
| `numIncr(5, 2) //=> 7` | Result. |
| `numWrap(7, 0, 5) //=> 2` | Result. |

## Pseudo-Random Number Functions (Seeded)
| Example | Returns |
| --- | --- |
| `getCoinToss(0.7) //=> true` | True/false based on probability (default 0. |
| `getRandElement([1, 2, 3]) //=> 2` | A random element from the array. |
| `getRandFloat(1.0, 10.0) //=> 7.234` | A random float between min and max. |
| `getRandInt(1, 10) //=> 7` | A random integer between min and max (inclusive). |
| `getRandIntNormal(1, 10) //=> 6` | A random integer using a normal distribution between min and max. |
| `getRandNormal(1.0, 10.0) //=> 5.123` | A random float using a normal distribution between min and max. |
| `getRandom() //=> 0.23489210239` | A float between 0 and 1 using the seeded PRNG. |
| `randAlphaNum(8) //=> "A7b9X2m1"` | A random alphanumeric string of the specified length. |
| `randDice(20) //=> 15` | Result. |
| `randRollDice(3, 6) //=> [4, 2, 6]` | Result. |
| `randSample([1, 2, 3, 4, 5], 3) //=> [2, 5, 1]` | N random elements from the array without replacement. |
| `randShuffle([1, 2, 3]) //=> [3, 1, 2]` | A shuffled copy of the array. |
| `randWeighted([0.1, 0.7, 0.2]) //=> 1` | An index based on weighted probabilities. |

## String Functions
| Example | Returns |
| --- | --- |
| `strCharAt("bear", 1) //=> "e"` | The character at the specified index. |
| `strCharCodeAt("A", 0) //=> 65` | The UTF-16 code unit at the specified index. |
| `strCodePointAt("B", 0) //=> 66` | The Unicode code point at the specified index. |
| `strConcat("a", "b", "c") //=> "abc"` | Result. |
| `strEndsWith("hello", "lo") //=> true` | True if the string ends with the search string. |
| `strIncludes("hello", "ell") //=> true` | True if the string includes the search string. |
| `strIndexOf("hello", "l") //=> 2` | The index of the search string, or -1. |
| `strIsWellFormed("hello") //=> true` | True if the string is well-formed. |
| `strLastIndexOf("hello", "l") //=> 3` | The last index of the search string, or -1. |
| `strLength("bear") //=> 4` | The length of the given string. |
| `strLocaleCompare("a", "b") //=> -1` | Result. |
| `strMatch("abc123", "\\d+") //=> ["123"]` | Result. |
| `strMatchAll("a1b2", "\\d") //=> [["1"], ["2"]]` | All matches for a regular expression. |
| `strNormalize("hello") //=> "hello"` | A normalized Unicode string. |
| `strPadEnd("hi", 5, ".") //=> "hi..."` | Result. |
| `strPadStart("hi", 5, ".") //=> "...hi"` | Result. |
| `strRepeat("ha", 3) //=> "hahaha"` | Result. |
| `strReplace("hello", "l", "x") //=> "hexlo"` | Result. |
| `strReplaceAll("hello", "l", "x") //=> "hexxo"` | Result. |
| `strSearch("hello", "l") //=> 2` | Result. |
| `strSlice("hello", 1, 4) //=> "ell"` | A slice of the string. |
| `strSmall("hi") //=> "<small>hi</small>"` | The string in a small HTML tag. |
| `strSplit("a-b-c", "-") //=> ["a","b","c"]` | Result. |
| `strStartsWith("hello", "he") //=> true` | True if the string starts with the search string. |
| `strSubstr("hello", 1, 3) //=> "ell"` | A substring using start and length. |
| `strSubstring("hello", 1, 4) //=> "ell"` | A substring using start and end. |
| `strTrim("  hi  ") //=> "hi"` | Result. |
| `strTrimEnd("hi  ") //=> "hi"` | Result. |
| `strTrimLeft("  hi") //=> "hi"` | Result. |
| `strTrimRight("hi  ") //=> "hi"` | Result. |
| `strTrimStart("  hi") //=> "hi"` | Result. |
| `strValueOf("hi") //=> "hi"` | The primitive string value. |
| `toCamelCase("hello-world") //=> "helloWorld"` | CamelCase form of the given string. |
| `toCapitals("bear") //=> "Bear"` | A capitalized form of the given string. |
| `toKebabCase("helloWorld") //=> "hello-world"` | Kebab-case form of the given string. |
| `toList(["a", "b", "c"]) //=> "a, b and c"` | Converted value. |
| `toLocaleLowerCase("HELLO", "en-US") //=> "hello"` | A locale-aware lowercase string. |
| `toLocaleUpperCase("hello", "en-US") //=> "HELLO"` | A locale-aware uppercase string. |
| `toLowerCase("HELLO") //=> "hello"` | A lowercase string. |
| `toOrdinal(21) //=> "21st"` | Ordinal form of a number. |
| `toPlural("cat", 2) //=> "cats"` | Plural form of a word based on count. |
| `toSnakeCase("helloWorld") //=> "hello_world"` | Snake_case form of the given string. |
| `toString("hi") //=> "hi"` | The string value. |
| `toTitle("hello world") //=> "Hello World"` | Title case form of the given string. |
| `toUncapitals("Bear") //=> "bear"` | An uncapitalized form of the given string. |
| `toUpperCase("hello") //=> "HELLO"` | An uppercase string. |
| `toWellFormed("hello") //=> "hello"` | The string normalized to well-formed Unicode. |

## Unified Functions
| Example | Returns |
| --- | --- |
| `cond(true, "yes", "no") //=> "yes"` | The first value whose condition is truthy, or the default, or null. |
| `doesContain("hello", "ell") //=> true` | True if the value contains the search value. |
| `doesHave("hello", "lo") //=> true` | True if the value has the search value. |
| `doesInclude([1,2,3], 2) //=> true` | True if the value includes the search value. |
| `getLength([1,2,3]) //=> 3` | The length of a string or array, or false if unsupported. |
| `isBlank("") //=> true` | True if the value is blank (empty string, empty array, empty object, zero, null, or undefined). |
| `isPresent("hi") //=> true` | True if the value is present (not blank). |
| `toBoolean("true") //=> true` | Converted value. |
| `toNumber("42") //=> 42` | Converted value. |
| `toString(42) //=> "42"` | Converted value. |

## World Functions
| Example | Returns |
| --- | --- |
| `coLocated("ALICE", "BOB") //=> true` | True if the entities overlap in world location. |
| `entity("ALICE") //=> {"name":"ALICE","kind":"person"}` | Entity snapshot with name and stats, or null if missing. |
| `loc("ALICE") //=> {"place":"JURY ROOM","rel":"in"}` | Location object, or null if the entity has no location. |
| `pov("ALICE") //=> {"you":{...},"people":[...],"things":[...],"places":[...],"events":[...]}` | Subjective POV object with visible entities and events. |
| `visibleTo("ALICE", "BOB") //=> true` | True if target is visible to observer. |
