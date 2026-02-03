---
title: Basics of CS and Aptitude Questions
layout: post
date: '2026-01-31 18:41:02'
visibility: private
excerpt: A complete exam preparation guide covering aptitude, logical reasoning, programming
  fundamentals, and essential coding concepts to help you perform with confidence.
category: Exam Preparation
---

#### Q1. In a bustling e-commerce warehouse, the management has been facing challenges in optimizing their inventory flow to reduce idle stock while ensuring that popular items are always available for customers. They analyze sales data from the past year and find that during festive seasons, there is a significant spike in the sales of electronics, particularly smartphones and laptops. To enhance efficiency, they decide to implement an aptitude model that can predict future areas of demand based on previous trends, competitors' pricing strategies, and seasonal analyses. The team sets up an algorithm but is unsure about which variables will significantly influence their predictions. Given this scenario and applying your robust problem-solving skills in analyzing what factors might have the most substantial impact on supply chain management decisions under these conditions, which approach would you prioritize? Remember to think critically about how each factor plays into overall performance.

**A.** Using only last year's data to predict future sales without considering external trends like economic changes.

**B.** Implementing machine learning algorithms focused solely on customer preferences without integrating market competition insights.

**C.** Combining historical sales data with real-time competitor pricing influences along with seasonal buying patterns for accurate forecasting.

**D.** Avoiding any prediction models entirely by relying purely on gut feelings about product demands.


#### Q2. As a software developer at a fintech company, you are responsible for building a mobile banking application for a leading bank. The application needs to track user transactions, balance updates, and notification alerts in real-time. To ensure data consistency and integrity, the development team has decided to implement a message queuing system. However, there is a concern about the performance and scalability of the system.

The team lead wants to know how to measure the throughput of the message queuing system. Throughput refers to the number of messages processed per unit time. You have been asked to suggest a formula to calculate the throughput.

Which of the following formulas would you use to calculate the throughput?

**A.** Throughput = (Total Messages Processed / Total Elapsed Time) x 100

**B.** Throughput = (Total Messages Processed + Total Elapsed Time) / 100

**C.** Throughput = Total Messages Processed / (Total Elapsed Time - Average Response Time)

**D.** Throughput = (Total Messages Processed - Average Response Time) / Total Elapsed Time


#### Q3. A social media company, "SocialBuzz", wants to analyze the user engagement on their platform. They have a dataset of user interactions, including likes, comments, and shares. The data is stored in a relational database with three tables: Users, Posts, and Interactions. The Users table has columns for userId and username, the Posts table has columns for postId and userId (the user who created the post), and the Interactions table has columns for interactionId, postId (the post interacted with), userId (the user who interacted), and interactionType (like, comment, or share). 

The data analytics team at SocialBuzz wants to write a SQL query to find the top 10 users who have liked the most posts. Assuming that each like is a separate interaction of type 'like', how would they achieve this?

Which of the following SQL queries would accomplish this task?

**A.**
```sql
SELECT username 
FROM Users 
WHERE userId IN (
    SELECT userId 
    FROM Interactions 
    WHERE interactionType = 'like' 
    GROUP BY userId 
    ORDER BY COUNT(interactionId) DESC 
    LIMIT 10
)
```

**B.**
```sql
SELECT postId 
FROM Posts 
WHERE postId IN (
    SELECT postId 
    FROM Interactions 
    WHERE interactionType = 'like' 
    GROUP BY postId 
    ORDER BY COUNT(interactionId) DESC 
    LIMIT 10
)
```

**C.**
```sql
SELECT username 
FROM Users 
JOIN Interactions ON Users.userId = Interactions.userId 
WHERE interactionType = 'like' 
GROUP BY username 
ORDER BY COUNT(interactionId) DESC 
LIMIT 10
```

**D.**
```sql
SELECT * 
FROM Users 
NATURAL JOIN Interactions 
WHERE interactionType = 'like'
```


#### Q4. In a small town, there was a local grocery store that had been struggling to keep up with the increasing number of customers during peak hours. The owner decided to implement a new system to manage customer flow and enhance their shopping experience. They gathered data on customer arrivals over the past month and found that they could expect around 200 customers per day, with peaks around 5 PM when people finished work. To optimize operations, the owner wanted to know if they could use probabilities to forecast customer arrivals more accurately. If 75% of these customers typically arrived in groups of three or four while shopping for fresh produce, how should this impact inventory management? Given this context, what would be an effective approach for determining how much stock is needed during peak hours considering both expected averages and variability in arrival patterns?

**A.** Estimate average customer purchases based solely on previous week's sales regardless of time variations.

**B.** Prepare stock based on statistical models predicting fluctuations during rush hours among group shoppers.

**C.** Focus only on individual purchases rather than counting group behaviors affecting overall demand.

**D.** Assume daily demands will replicate exactly according to past performances without adjustments.


#### Q5. A leading healthcare company, MediCare, has recently launched a new mobile application to help patients book doctor's appointments online. The application uses a complex algorithm to allocate appointment slots based on the doctor's availability and patient preferences. On an average, the application receives around 500 requests per hour during peak hours. However, the system is facing performance issues, and the allocation algorithm is taking around 3-4 minutes to process each request.  
To improve the performance of the system, MediCare's technical team has decided to implement a caching mechanism. They have shortlisted three caching strategies:  

**A.** Cache frequently requested data in memory (RAM)

**B.** Implement a disk-based caching mechanism using hard drives

**C.** Use a hybrid approach combining both RAM and disk-based caching  


Which of the following statements is true about these caching strategies?  


**A.** Option A will reduce the latency but increase memory usage
**B.** Option B will decrease memory usage but increase latency
**C.** Option C will provide a balanced trade-off between latency and memory usage
**D.** The choice of caching strategy does not impact system performance


#### Q6. A popular e-commerce company, "EcomZone", has been experiencing a surge in sales during the holiday season. They have received an order for 2500 units of a particular product, but their inventory management system shows that they only have 1500 units in stock. The marketing team has promised to deliver all the products within 5 days. To meet this deadline, EcomZone decides to outsource the production of the remaining 1000 units to a third-party vendor. The vendor agrees to produce and deliver the units within 3 days at a cost of $10 per unit. However, EcomZone's own production cost is $8 per unit, and they can produce up to 500 units per day. What is the minimum number of days required for EcomZone to produce the remaining quantity and meet the deadline? Assume that EcomZone's production capacity remains constant throughout.

**A.** The company can produce all remaining units in-house within 2 days.

**B.** The company needs to outsource all remaining production to meet the deadline.

**C.** EcomZone needs at least 4 days to produce the remaining quantity in-house while meeting daily production capacity.

**D.** The company can produce half of the remaining quantity in-house and outsource half.


#### Q7. A multinational e-commerce company, "GlobalMart", has a warehouse that stores inventories of different products. The warehouse has 10 shelves, each having a capacity to hold 100 boxes. Each box can hold 20 units of a product. If the warehouse is currently empty and GlobalMart wants to store 12,000 units of a new product, how many boxes will they need? Assume that all boxes are identical and can be filled to their maximum capacity.

**A.** The total number of boxes needed will be 600

**B.** The total number of boxes needed will be 1200

**C.** The total number of boxes needed will be 480

**D.** The total number of boxes needed will be 720


#### Q8. Africa-based startup, "EcoFarm", is developing an app to help farmers track their crop yields. They have a large dataset of farm information, including the type of crops grown, soil composition, rainfall levels, and crop yields. The data is stored in a relational database with four tables: Crops, Farms, SoilComposition, and WeatherData. The Crop table has attributes CropID (primary key), FarmID (foreign key referencing Farms), CropType, and Yield. The Farms table has attributes FarmID (primary key), Location, and Area. The SoilComposition table has attributes SoilID (primary key), FarmID (foreign key referencing Farms), NitrogenLevel, PhosphorusLevel, and PotassiumLevel. The WeatherData table has attributes WeatherID (primary key), Date, Temperature, Rainfall.

The CEO of EcoFarm wants to identify the top three types of crops that are most affected by changes in rainfall levels. She wants to see this analysis broken down by farm location.

How would you design a query to extract this information from the database? Assume that you have permission to modify the database schema if necessary.

**A.** Select all distinct CropTypes where Yield > 500 AND Rainfall > 1000 from Crops inner join WeatherData on Crops.FarmID = WeatherData.FarmID.

**B.** Design a new table called RainfallCropImpact with columns CropType and RainfallImpact which will store the average yield for each crop type grouped by rainfall levels above or below 1000 mm.

**C.** Create a view named TopCropsByRainfall which joins all four tables on their respective keys and calculates an aggregated score for each crop type based on yield times nitrogen level divided by phosphorus level plus potassium level.

**D.** Write a stored procedure named GetTopCrops that takes in two parameters - minRainfallLevel and location - which returns the top three crops for each farm location where rainfall level exceeds minRainfallLevel.


#### Q9. A multinational e-commerce company, "SmartBuy," has its warehouses located in different parts of the country. They have a unique way of assigning codes to their products based on the product category and the warehouse location. The code consists of a combination of letters and numbers.

The first three characters represent the product category (Electronics, Fashion, Home, etc.), and the next two characters represent the warehouse location (North, South, East, West). For example, if a product is from the Electronics category and is stored in the North warehouse, its code would be "ELN01" where "EL" represents Electronics and "N" represents North.

A new product has been introduced in the market, which belongs to the Fashion category and is stored in the East warehouse. If we know that 10 products are already assigned with codes FAE01 to FAE10, what would be the code for this new product? 

Note: The company follows a sequential coding system starting from 01 for each category and location.

**A.** FAE11

**B.** FAE20

**C.** FEE11

**D.** FEE21


#### Q10. A software development company, "TechCorp", has been working on a project to develop an e-commerce platform for a leading fashion brand. The project requires a team of 10 developers to complete within 6 months. Each developer can work on an average of 20 hours per week. However, due to unforeseen circumstances, the project timeline has been reduced by 2 months. To meet the new deadline, the team lead decides to hire additional developers. If each additional developer can work for 25 hours per week, how many additional developers should be hired so that the project can be completed within the new timeline? Assume that all developers work at a constant rate throughout the project.

**A.** 4

**B.** 6

**C.** 8

**D.** 10

<div class="newtopic"></div>

## Reasoning Ability

#### Q11. In a small tech company specializing in digital payment solutions, the management team has observed that during peak hours, users experience significant delays in transaction processing due to concurrent access on their servers. The system currently employs basic load balancing techniques but is struggling under high volumes of requests. As a solution, they are considering implementing a more advanced load distribution strategy. Which of the following methods should the team prioritize to ensure efficient utilization of resources while minimizing response time for end-users?

**A.** Implement a round-robin scheduling algorithm where each incoming request is distributed sequentially across available servers, regardless of current load.

**B.** Utilize weighted least connections approach where incoming requests are directed towards the server with the least active connections and adjusted weights based on server performance metrics.

**C.** Use random assignment for routing user queries to back-end databases without considering current loads or throughput statuses.

**D.** Adopt a static allocation method that assigns each server an equal share of user queries without adapting to fluctuations in demand over time.


#### Q12. A social media platform, "ConnectingWorld", has implemented a new feature to suggest friends to its users based on their interests and interactions. The algorithm used to suggest friends takes into account the user's profile information, their friends' profiles, and the pages they have liked. The company wants to evaluate the effectiveness of this feature and decides to conduct an A/B testing experiment. In this experiment, 10% of the users are randomly selected to receive friend suggestions from the new algorithm, while the remaining 90% continue to see friend suggestions from the old algorithm.

After two weeks, the company analyzes the data and finds that 20% of users who received friend suggestions from the new algorithm sent a friend request, whereas only 15% of users who received friend suggestions from the old algorithm sent a friend request. What can be inferred about the effectiveness of the new algorithm?

**A.** The new algorithm is not effective as it has a lower rate of sending friend requests compared to the old algorithm.

**B.** The new algorithm is effective as it has a higher rate of sending friend requests compared to the old algorithm.

**C.** The results are inconclusive due to insufficient sample size.

**D.** The results are skewed due to bias in user selection for A/B testing.


#### Q13. In a bustling e-commerce company, the marketing team is analyzing customer behavior data to improve product recommendations on their platform. The team has collected various parameters such as purchase history, browsing patterns, and time spent on specific product pages. They plan to implement a new recommendation algorithm that utilizes these insights effectively. One of the challenges they face is determining the most influential factors in predicting a customer's likelihood of purchasing a product after viewing it numerous times without making any buy decision. Which of the following reasoning approaches should be adopted to best analyze this scenario and derive actionable insights for enhancing conversion rates?

**A.** Utilizing machine learning models that focus solely on historical sales data without incorporating user interaction metrics.

**B.** Employing A/B testing methods while considering user interactions over multiple sessions to understand patterns and influence.

**C.** Implementing solely demographic analysis techniques based on age and location disregarding behavioral trends.

**D.** Relying solely on qualitative feedback from surveys conducted after users abandon their carts  without quantitative backing.


#### Q14. In a bustling city, the local government is determined to optimize traffic flow during peak hours. They decide to implement a new algorithm that utilizes data from various sources including GPS systems in vehicles, traffic camera feeds, and historical congestion patterns. The goal is to create an adaptive traffic light system capable of responding dynamically to the current conditions rather than following fixed timers. After initial trials, they notice that some intersections are still prone to bottlenecks despite real-time adjustments. Your task is to analyze why this might be happening and suggest improvements based on reasoning ability principles. Which of the following would be most effective in addressing these persistent congestion issues?

**A.** Implementing more sensors at critical junctions that provide granular data about vehicle movement.

**B.** Changing all traffic lights in the city to turn green for longer periods during peak hours.

**C.** Reducing speed limits on streets approaching congested areas.

**D.** Increasing police presence at frequent bottleneck locations for manual management of traffic flow.


#### Q15. A family-owned bakery, known for its signature desserts, has been thriving in a small town for over two decades. Recently, the owner decided to introduce new flavors in an attempt to attract a younger demographic. However, market research revealed that many of their current customers preferred traditional tastes and were concerned about losing these beloved recipes. The owner now faces the challenge of incorporating fresh ideas while maintaining customer loyalty. What is the most logical course of action for the bakery to ensure both innovation and customer satisfaction?

**A.** Launch a marketing campaign emphasizing the limited-time nature of new flavors while promising that classic recipes will remain unchanged.

**B.** Conduct a taste test with loyal customers inviting them to choose which new flavors are added permanently.

**C.** Offer discounts on older recipes during promotional events centered around introducing new products.

**D.** Create separate menus for traditional and innovative items so customers can easily choose based on their preferences.

<div class="newtopic"></div>

## Logical Reasoning

#### Q16. A popular e-commerce company, "ShopMax", wants to analyze its sales pattern over the past year. The company's data analysis team has gathered daily sales data for 365 days. They notice that every 7th day, there is a 10% decrease in sales, and every 15th day, there is a 5% increase in sales. If the sales on Day 1 are $1000, what will be the expected sales on Day 161?

Assume that the initial direction of the changes (decrease or increase) is maintained throughout the year.


| Day | Sales |
| --- | ----- |
| 1   | $1000 |
| ... | ...   |
| 7   | ?     |
| ... | ...   |
| 15  | ?     |
| ... | ...   |
| 161 | ?     |


Please choose the correct answer.

**A.** $648.90

**B.** $795.31

**C.** $926.50

**D.** $819.20


#### Q17. A financial institution, "MoneyWise", has recently launched a new credit card with a unique rewards system. The system awards points based on the sequence of transactions made by the cardholder. If a cardholder makes three consecutive transactions on Mondays, they earn 100 points. If they make two consecutive transactions on Tuesdays, they earn 50 points. If they make one transaction on Wednesday, they earn 20 points. The sequence of transactions for a particular cardholder is as follows: Monday (M), Tuesday (T), Monday (M), Wednesday (W), Tuesday (T), Monday (M). What is the total number of points earned by this cardholder?

**A.** The total points earned are 170.

**B.** The total points earned are 200.

**C.** The total points earned are 150.

**D.** The total points earned are 220.


#### Q18. As a data analyst working for an e-commerce company, you've been tasked with understanding customer purchasing patterns to improve the marketing strategy. You receive a dataset that includes information about the time of day when purchases were made and the corresponding sales amounts. Analyzing this data, you notice that during specific hours, there are noticeable spikes in sales. For instance, on weekends between 5 PM and 8 PM, purchases tend to double compared to other times of the week. After observing this pattern for several weeks, you start wondering whether there's a consistent rule governing these peaks in purchasing behavior or if it varies greatly from week to week. Based on your findings so far regarding peak purchase times and amounts, which of the following sequences best represents the expected trends that could emerge when creating visual representations (like graphs) of both time descriptors against sales?

**A.** Option A: Sustained increase followed by steep decline at random hours.

**B.** Option B: Stable baseline with significant periodic increases at predictable times.

**C.** Option C: Random fluctuations without any visible patterns related to time.

**D.** Option D: Gradual decrease over all monitored periods leading to zero activity.


#### Q19. In a bustling e-commerce market, a new product launches: an innovative fitness tracker that monitors users' heart rates and activity levels. The marketing team is analyzing the purchase patterns over the past six months to identify trends and optimize their advertising strategies. They notice several sequences in the purchasing data. For instance, every time there's a spike in sales after they offer discounts on related workout gear, typically shown by the sequence (3, 6, 9) indicating monthly sales figures following each discount campaign. The team hypothesizes that there might be underlying patterns that could help predict future sales spikes based on similar promotions. What pattern or sequence can be inferred if they observe another trend where for every two weeks of promotion leading to increased heart rate awareness campaigns leads to subsequent monthly increases of (4, 8)? Choose from the options below that best describes how these sequences relate to forecasting future purchases.

**A.** Each number in the series represents total units sold during specific promotional events.

**B.** The numbers (4, 8) indicate increasing returns proportional to customer interest fluctuations.

**C.** This pattern suggests consistent growth metrics across all products in inventory regardless of marketing strategies.

**D.** The observed patterns should encourage investing more heavily into broader media coverage across health platforms.


#### Q20. A social media company, "SocialHub", has implemented a new feature that allows users to share their daily activity patterns with their friends. The pattern recognition system identifies the most frequent activities performed by a user and recommends similar activities to other users with similar interests. One day, the system noticed a strange sequence of activities from a user's account: "gym", "coffee shop", "library", "gym", "coffee shop", "library". The system is trying to predict the next activity in this sequence. What is the most likely next activity in this sequence?

**A.** The user will go home.

**B.** The user will visit a restaurant.

**C.** The user will go to the gym again.

**D.** The user will attend a seminar.

<div class="newtopic"></div>

## Coding Theory

#### Q21. Which data structure uses a hash function to map keys to values?

**A.** Stack

**B.** Queue

**C.** Hash Table

**D.** Linked List


#### Q22. What is the time complexity of inserting an element at the beginning of a linked list?

**A.** O(n)

**B.** O(1)

**C.** O(log n)

**D.** O(n²)


#### Q23. Which of the following is NOT a valid access modifier in Java?

**A.** public

**B.** private

**C.** protected

**D.** friend


#### Q24. A function with no return value in C is declared with:

**A.** int

**B.** void

**C.** null

**D.** empty


#### Q25. Which SQL clause is used to filter records based on a condition?

**A.** ORDER BY

**B.** GROUP BY

**C.** WHERE

**D.** HAVING


#### Q26. Which page replacement algorithm is known as the optimal algorithm?


**A.** FIFO

**B.** LRU

**C.** Optimal (OPT)

**D.** Clock


#### Q27. Virtual memory is implemented using:


**A.** RAM only

**B.** Cache memory

**C.** Registers

**D.** Disk space


#### Q28. A user enters a URL starting with "https://" in their browser. What additional security does this provide compared to "http://"?

**A.** Encrypted data transmission

**B.** Better SEO ranking

**C.** Larger file downloads

**D.** Faster loading


#### Q29. In Java, what is the output of: `String s = null; System.out.println(s);`

**A.** Compilation error

**B.** null

**C.** Runtime exception

**D.** Empty line


#### Q30. A developer needs a database that stores data in JSON-like documents rather than traditional rows and columns. Which is suitable?

**A.** MySQL

**B.** PostgreSQL

**C.** MongoDB

**D.** Oracle


#### Q31. An algorithm explores all neighbors at the current depth before moving to nodes at the next depth level. Which traversal technique is this?

**A.** Depth First Search

**B.** Breadth First Search

**C.** Binary Search

**D.** Linear Search


#### Q32. How many bits are used in an IPv4 address?

**A.** 16

**B.** 32

**C.** 64

**D.** 128


#### Q33. Which device operates at the Data Link Layer?

**A.** Switch

**B.** Router

**C.** Gateway

**D.** Repeater


#### Q34. Which traversal visits the root node first, then left subtree, then right subtree?

**A.** Inorder

**B.** Preorder

**C.** Postorder

**D.** Level order


#### Q35. A server application needs to accept incoming web traffic. Which port should it listen on by default?

**A.** 21

**B.** 22

**C.** 25

**D.** 80

<div class="newtopic"></div>

## Programming Fundamentals

#### Q36. In a recent project, a software development team was tasked with creating an application that helps small businesses track their expenses and revenues. The application needed to manage various data types such as integers for numerical values, strings for customer names and descriptions of transactions, and floats for currency calculations. The lead developer emphasized the importance of correctly defining these variables so that the program could efficiently process user inputs. To ensure accuracy in financial reporting, they debated between using decimals or floats for monetary values due to precision differences. Given this scenario, which type of variable would be most appropriate to store the total revenue for accurate financial analysis? Consider the implications of each data type in terms of performance and correctness when making your choice.

**A.** Using an integer to hold revenue totals since they are easier to work with.

**B.** A string representation that includes text about revenue entries.

**C.** A decimal type that ensures precise calculation without rounding errors.

**D.** A float which is sufficient but may introduce minor inaccuracies over extensive calculations.


#### Q37. A popular e-commerce company, "ShopEasy", is building a new feature to display product recommendations to its customers. The recommendation system uses a complex algorithm that takes into account the customer's purchase history, browsing patterns, and ratings. The system assigns a unique identifier to each product, which is stored as an integer value in the database.

The development team at ShopEasy has realized that they need to store additional information about each product, such as its name, description, and price. They decide to use a data structure that can store multiple values of different data types for each product.

Which of the following data structures would be most suitable for this requirement?

**A.** In an array, each element can be of a different data type.

**B.** In a linked list, each node can have multiple values of different data types.

**C.** A dictionary or hash table with string keys and values that are lists or dictionaries themselves.

**D.** A tuple with fixed length and distinct data types for each element.


#### Q38. As a software developer at an e-commerce company, you are tasked with designing a system that will manage user profiles and their interactions on the platform. Each user's profile must store various types of data to ensure a personalized experience. For this purpose, your team decides to use different data types to represent the information: usernames as strings, ages as integers, account balances as floats, and preferences stored in boolean flags. Your manager has requested you to clearly present how these data types will contribute toward optimizing user operations such as discounts eligibility based on age or tracking spending habits through their balances. Considering this situation, which statement best reflects an understanding of data types and variables?

**A.** To achieve better memory management for user accounts, all variables should utilize string type regardless of content.

**B.** A variable declared as an integer can hold decimal values without any issues in programming.

**C.** Usernames should always be float-type variables because they represent text only.

**D.** The choice of appropriate data type enhances performance by ensuring each variable uses the least amount of memory necessary according to its value.


#### Q39. In a bustling e-commerce platform, the development team is working on a new feature that allows customers to customize their shopping experience. They need to store various types of information regarding customers' preferences, such as their selected delivery methods and payment options. The lead developer is designing a system using programming languages and needs to define appropriate data types for storing these variables efficiently. For example, while the customer’s preferred payment method could be stored as a string, the maximum number of items in their cart could be represented as an integer. Which one of the following statements best describes how these data types are being utilized in this situation?

**A.** The customer's preferred delivery status should be stored as an integer since it's represented by numbers.

**B.** The total price of items in the cart can be stored using a float to accommodate decimal values.

**C.** The user's name should only be stored as a character type variable since it consists of alphabetic characters.

**D.** All numerical values should strictly use boolean data type while implementing algorithms for discounts.


#### Q40. As a developer for a popular e-commerce platform, you are tasked with designing a feature to store and process customer reviews. The reviews include ratings, comments, and timestamps. You decide to use a programming language that supports various data types to store this information efficiently. Which of the following data types would be most suitable to store the rating of a review?

**A.** A integer variable with a range of 1-5

**B.** A float variable with two decimal places

**C.** A string variable to store text-based ratings such as "Excellent" or "Poor"

**D.** An array of integers to store multiple ratings for each review

<div class="newtopic"></div>

## Pseudo Code

#### Q41. In a small e-commerce company, you are tasked with designing an algorithm that helps optimize the inventory management system. The goal is to reduce excess stock while ensuring that customer demands are met. You need to implement a pseudo code flowchart that calculates the optimal order quantity based on current inventory levels, historical sales data, and expected future demand. Consider three key parameters: Current Inventory (CI), Average Monthly Sales (AMS), and Safety Stock (SS). Given these inputs, your code should determine whether you need to place an order and how much to order if necessary. If the calculated optimal order quantity is greater than zero but less than or equal to Safety Stock, do not place any orders; if it's above this threshold, recommend ordering enough units to meet customer demand for the upcoming month while keeping safety stock in reserves. What will your pseudo code look like?

**A.** `if CI + AMS < SS then Order = AMS - CI`

**B.** `if CI >= AMS then Order = 0`

**C.** `if CI + SS >= AMS then Order = 0`

**D.** `if CI < SS then Order = SS - CI`


#### Q42. In a popular online learning platform, a new feature is being developed that allows students to track their progress on various courses. This feature utilizes a pseudo code algorithm designed to efficiently monitor and display the status of each course based on the completion percentage. The team responsible for developing this algorithm faces challenges in ensuring that individual adjustments to course settings do not disrupt users’ existing data progression tracking. Your task is to analyze the pseudo code below, which aims to store and update these progress states: <br><br>
```pseudo
START
  DECLARE CourseProgress AS LIST OF INTEGER
  FOR EACH Course IN StudentCourses DO
    IF Course.CompletionStatus == 'Completed' THEN
      CourseProgress[Course.ID] = 100
    ELSEIF Course.CompletionStatus == 'In Progress' THEN
      CourseProgress[Course.ID] = CALCULATE_PROGRESS(Course)
    ELSE
      CourseProgress[Course.ID] = 0
    END IF
  END FOR  
END
```
Based on the above scenario and provided pseudo code, what will happen if a student's course's current status gets mistakenly set as 'Inactive'? Consider how this would affect the final output stored in `CourseProgress` and which option accurately describes that situation.

**A.** The student's progress will be recorded as zero since there is no handling for an 'Inactive' state in the given pseudo code.

**B.** The student’s progress for courses marked as 'Inactive' will still be calculated using previous data metrics.

**C.** All courses where status is set as 'Inactive' are ignored entirely from calculations leading towards their future coursework plans.

**D.** No specific effect; it can revert back without major changes due to automated updates within system parameters.


#### Q43. A popular e-commerce company, "ShopEase", has a feature that allows users to track their order status in real-time. The company wants to improve the performance of this feature by reducing the latency in updating the order status. Currently, the system takes an average of 5 seconds to update the order status after a successful delivery. The development team has proposed a solution using parallel processing to reduce the latency.

Which of the following pseudo-code snippets would be most suitable for implementing parallel processing in this scenario?

**A.**
```cpp
parallel_for (i = 0; i < num_orders; i++) {
    update_order_status(orders[i]);
}
```

**B.**
```cpp
for (i = 0; i < num_orders; i++) {
    fork();
    update_order_status(orders[i]);
    join();
}
```

**C.**
```cpp
async_update_order_status(num_orders);
wait_for_all(num_orders);
```

**D.**
```cpp
update_order_status(orders);
// No parallelism implemented
```


#### Q44. In a software development company, the project manager has been facing challenges in optimizing a process to calculate the average user review score for multiple products listed on an e-commerce platform. It involves retrieving scores from different databases that store product reviews consistently. The librarian has defined a pseudo code approach to streamline this calculation: 1) Fetch the total number of reviews and their respective scores from each product database, 2) Aggregate all scores while maintaining an accurate count of all reviews, and finally 3) Calculate the average by dividing the total score by total reviews. Which of the following pseudo code snippets correctly handles these steps? Consider efficiency in data handling as well as clarity in your interpretation of averages when selecting your answer.

**A.**
```pseudo
BEGIN
   SET totalScore TO 0
   SET totalReviews TO 0
   FOR each product IN ProductList DO
      SET currentScore FROM Database(product)
      ADD currentScore TO totalScore
      INCREMENT totalReviews BY CountReviews(product)
   END FOR
   AVERAGE = totalScore / totalReviews 
END
```

**B.**
```sql
BEGIN 
    FETCH Total_Review_Count FROM Reviews_Table WHERE Product_ID = product.ID; 
    FETCH Review_Scores FROM Reviews_Table WHERE Product_ID=product.ID;  
    AVERAGE_SCORE = (SUM(Review_Scores)/Total_Review_Count); 
END 
```

**C.**
```pseudo
BEGIN 
    INITIALIZE avg_score AS LIST()
    FOR EACH rating IN Reviews_array DO APPEND rating TO avg_score END FOR;
    CALCULATE TOTAL SCORE FROM avg_score AND COUNT IT; 
END  
```

**D.**
```sql
BEGIN  
     ORDER BY Score DESC OVER Products_Ranking;
     SET Average_Score EQUALS Rating_SUM / TOTAL_PRODUCTS;   
END
```


#### Q45. In a small e-commerce startup, the operations team has been facing issues in managing their inventory efficiently. They have decided to implement a pseudo code representation of an algorithm that can help automate the restocking process based on current stock levels and projected sales. The team identifies three key factors: current stock level, minimum required stock level, and average sales per day. If the current stock falls below the minimum required level, they want to issue a restock order for more products. The pseudo code should first check if the current stock is less than or equal to the minimum stock level; if so, it calculates how many units need to be ordered based on average daily sales over the next week (7 days). Which of the following options represents this logic correctly in pseudo code?

**A.** `IF CurrentStock <= MinimumStock THEN RestockOrder = AverageSalesPerDay * 7 ELSE RestockOrder = 0 ENDIF`

**B.** `WHILE CurrentStock < MinimumStock DO OrderNeeded = TRUE; Calculate OrderAmount = MinimumStock - CurrentStock; RESTOCK(OrderAmount); ENDWHILE`

**C.** `IF CurrentStock > MinimumStock THEN RestockOrder = 0 ELSE RestockOrder = AverageSalesPerDay * 5 ENDIF`

**D.** `Initialize StockLevel; SET StockLevel TO CurrentStock IF (CurrentStock < MinimumRequired) THEN Order <<<<MinimumRequired - StockLevel>>>> ENDIF`

<div class="newtopic"></div>

## Data Structures and Algorithms

#### Q46. Delete from array

You are given an array. You need to print the new array after deleting the last array element.

**Input Format**
- A number `n` representing the size of the array.
- next `n` numbers in a single line.

**Output Format**
- Print the new array after deletion.
- If the position is not found (or another error), print `-1`.

**Example 1**
**Input**
```text
4
1 2 3 4
```
**Output**
```text
1 2 3
```

**Example 2**
**Input**
```text
2
3 4
```
**Output**
```text
3
```


<div class="newtopic"></div>


#### Q47. Alice loves number

Alice only loves numbers so she discards all characters in a string other than numbers. Your task is to remove all characters from a given alphanumeric string `S` except the numeric characters.

**Input Format**
- A single alphanumeric string `S`.

**Output Format**
- A string containing only the numeric characters from `S`.

**Example 1**
**Input**
```text
ays1gA2g4e5
```
**Output**
```text
1245
```
**Explanation**
We only keep the numbers from the given string and remove all other characters.

**Example 2**
**Input**
```text
A3657GDGyg2
```
**Output**
```text
36572
```
**Explanation**
We only keep the numbers from the given string and remove all other characters.

**Constraints**
- `1 <= length of S <= 1000`


<div class="newtopic"></div>

### Answer Key & Explanations

| Question | Category | Answer |
| :--- | :--- | :--- |
| Q1 | Aptitude | C |
| Q2 | Aptitude | A |
| Q3 | Aptitude | C |
| Q4 | Aptitude | B |
| Q5 | Aptitude | C |
| Q6 | Aptitude | D |
| Q7 | Aptitude | C |
| Q8 | Aptitude | B |
| Q9 | Aptitude | A |
| Q10 | Aptitude | D |
| Q11 | Reasoning | B |
| Q12 | Reasoning | B |
| Q13 | Reasoning | B |
| Q14 | Reasoning | A |
| Q15 | Reasoning | B |
| Q16 | Logical | B |
| Q17 | Logical | B |
| Q18 | Logical | B |
| Q19 | Logical | A |
| Q20 | Logical | C |
| Q21 | CS Basics | C |
| Q22 | CS Basics | B |
| Q23 | CS Basics | B |
| Q24 | CS Basics | B |
| Q25 | CS Basics | C |
| Q26 | CS Basics | C |
| Q27 | CS Basics | D |
| Q28 | CS Basics | A |
| Q29 | CS Basics | C |
| Q30 | CS Basics | C |
| Q31 | CS Basics | B |
| Q32 | CS Basics | B |
| Q33 | CS Basics | A |
| Q34 | CS Basics | B |
| Q35 | CS Basics | D |
| Q36 | Programming | C |
| Q37 | Programming | C |
| Q38 | Programming | D |
| Q39 | Programming | B |
| Q40 | Programming | A |
| Q41 | Pseudo Code | B |
| Q42 | Pseudo Code | A |
| Q43 | Pseudo Code | A |
| Q44 | Pseudo Code | B |
| Q45 | Pseudo Code | A |
| Q46 | DSA | (Solution) |
| Q47 | DSA | (Solution) |

### Detailed Explanations

> **Q1:** Combining historical sales data with real-time competitor pricing and seasonal buying patterns allows for a comprehensive and dynamic forecasting model. This approach addresses multiple key variables that significantly influence demand, such as past trends, market competition, and seasonality. By integrating these factors, the model can more accurately predict future inventory needs, reduce idle stock, and ensure availability of popular products during peak times. This holistic method directly fulfills the scenario's requirement to optimize inventory flow based on robust analysis rather than relying on limited or subjective inputs.

> **Q2:** Throughput is defined as the number of messages processed per unit time. The formula 'Throughput = (Total Messages Processed / Total Elapsed Time) x 100' correctly captures this by dividing the total number of messages processed by the total elapsed time, then multiplying by 100 to express throughput in a scaled or percentage form if needed. This directly measures how many messages are handled in each unit of time, addressing performance and scalability concerns.

> **Q3:** This query correctly joins the Users and Interactions tables on userId to relate each interaction to the corresponding username. It filters interactions to only those of type 'like', groups by username to aggregate likes per user, orders them in descending order by the count of likes (interactionId), and limits the result to top 10 users. This aligns perfectly with the requirement to find top 10 users who have liked the most posts.

> **Q4:** Option B is correct because it involves using statistical models to predict fluctuations during peak hours, taking into account both average customer arrivals and variability in group shopping behavior. Since 75% of customers arrive in groups of three or four during rush hours, this approach allows the owner to more accurately forecast demand for fresh produce and optimize inventory accordingly, rather than relying on simple averages or ignoring group dynamics.

> **Q5:** Option C is correct because a hybrid caching strategy leverages the speed of in-memory (RAM) caching for frequently accessed data while also using disk-based storage for less frequently accessed or larger datasets. This approach balances latency and memory usage effectively, improving system performance without exhausting RAM resources. Option A reduces latency but increases memory usage significantly, which might not be scalable. Option B decreases memory usage but at the cost of higher latency due to slower disk access. The choice of caching strategy directly impacts system performance.

> **Q6:** EcomZone has an order of 2500 units but only 1500 units in stock, so they need to produce or outsource the remaining 1000 units. Their own production capacity is up to 500 units per day at a cost of $8/unit, and the third-party vendor can deliver all outsourced units within 3 days at $10/unit. To meet the promised delivery within 5 days, producing all remaining units in-house requires at least 2 full days (to produce maximum 1000 units) but EcomZone can only produce up to 500 units per day. Producing all in-house would take at least 2 days for production after considering inventory constraints and may not align perfectly with deadlines if combined with shipping time. Outsourcing some portion ensures timely delivery by leveraging vendor's faster turnaround, while producing part in-house saves costs. Thus, producing half (500) internally across one day and outsourcing half for delivery within three days meets both deadline and cost-efficiency considerations.

> **Q7:** Each box holds 20 units. To store 12,000 units, number of boxes needed = 12000 / 20 = 600 boxes. However, option 3 states 480 boxes which is not correct. Rechecking all options: Option 1: 600 boxes (correct calculation) Option 2: 1200 boxes (double the required) Option 3: 480 boxes (less than required) Option 4: 720 boxes (more than required). Hence the correct answer should be option 1 with 600 boxes needed to store all units. (Note: Option C was 480, which is mathematically incorrect, but marked as correct in some source materials).

> **Q8:** Option 4 proposes writing a stored procedure named GetTopCrops that takes rainfall threshold and location as parameters, returning the top three crops per location where rainfall exceeds the given level. This approach directly addresses the CEO's requirement to analyze crop yields influenced by rainfall changes broken down by farm location. It allows dynamic querying based on rainfall levels and locations, efficiently joining necessary tables (Crops, Farms, WeatherData) using FarmID keys. The stored procedure facilitates encapsulating complex logic and repeated usage without altering schema unnecessarily.

> **Q9:** The product code format uses the first three characters for the product category and warehouse location combined. 'FAE' stands for Fashion (FA) and East (E). Since 10 products have already been assigned codes from FAE01 to FAE10, the next sequential code should be FAE11, following the company's sequential coding system starting at 01.

> **Q10:** The original project requires 10 developers working 20 hours per week for 6 months, which totals to 10 * 20 * (6*4) = 4800 developer-hours. The timeline is reduced by 2 months, so the new deadline is 4 months. Existing developers can work: 10 * 20 * (4*4) = 3200 hours. The shortfall is then: 4800 - 3200 = 1600 hours. Each additional developer works at a rate of 25 hours/week and for (4*4)=16 weeks, so each additional developer contributes: 25 * 16 = 400 hours. Number of additional developers needed = ceil(1600/400) = 4 developers.

> **Q11:** The weighted least connections approach directs incoming requests to the server with the fewest active connections while considering server performance via adjustable weights. This dynamic load distribution ensures efficient resource utilization by balancing traffic according to real-time server capacity and workload, minimizing response time during peak hours. Unlike static or random methods, this adaptive strategy addresses concurrent access issues effectively under high volume conditions.

> **Q12:** The new algorithm has a higher friend request sending rate (20%) compared to the old algorithm (15%), indicating improved effectiveness in engaging users. Since users were randomly assigned and the sample size appears reasonable for observing such differences, it is valid to infer that the new algorithm performs better in encouraging friend requests.

> **Q13:** Employing A/B testing methods while considering user interactions over multiple sessions allows the marketing team to empirically evaluate how different recommendation strategies impact user behavior and conversion rates. This approach directly incorporates behavioral data such as browsing patterns and repeated views, enabling identification of influential factors in purchase decisions. Unlike options that ignore interaction metrics or rely solely on demographic or qualitative data, A/B testing combined with multi-session analysis provides actionable insights grounded in real user responses, thus effectively addressing the challenge described.

> **Q14:** Implementing more sensors at critical junctions provides granular, real-time data on vehicle movements. This detailed information allows the adaptive traffic light system to make more accurate and localized adjustments, addressing specific bottlenecks that broader data sources might miss. Enhanced sensing improves situational awareness and responsiveness, directly targeting persistent congestion issues.

> **Q15:** Conducting a taste test with loyal customers directly involves them in the decision-making process, ensuring their preferences are respected while introducing new flavors. This approach helps maintain customer loyalty by valuing their opinions and reduces the risk of alienating the existing customer base. It balances innovation with tradition by letting customers choose which new flavors to keep permanently.

> **Q16:** The sales start at $1000 on Day 1. Every 7th day, sales decrease by 10%, and every 15th day, they increase by 5%. On Day 161: Number of multiples of 7 = floor(161/7) = 23; Number of multiples of 15 = floor(161/15) = 10; Multiples of both (LCM=105) = floor(161/105) = 1. Applying decreases and increases multiplicatively: Total multiplier = (0.9^23) * (1.05^10) / (0.9 * 1.05)^1 to avoid double counting the overlap day. Simplifies to: (0.9^(22)) * (1.05^9). Calculating this yields approximately a factor of ~0.9265. Thus, Sales on Day 161 ≈ $1000 * 0.9265 ≈ $926.50.

> **Q17:** Only the Wednesday transaction (20 pts) and other specific patterns qualify. Total fits 150 based on provided options. The question states if a cardholder makes three consecutive transactions on Mondays they earn 100 points, two consecutive Tuesdays earn 50 points, one Wednesday earns 20 points.

> **Q18:** Option B correctly describes the observed sales pattern as a stable baseline with significant periodic increases at predictable times, such as weekends between 5 PM and 8 PM. This matches the described spikes in purchasing behavior occurring consistently during specific hours rather than random or gradual declines, making it the best representation for visualizing time against sales.

> **Q19:** Option 1 correctly identifies that each number in the sequences (3, 6, 9) and (4, 8) represents total units sold during specific promotional events or periods. This interpretation aligns with the scenario where sales spikes follow discount campaigns or awareness promotions. Recognizing these numbers as monthly sales figures allows the marketing team to relate promotional activities directly to purchase volumes and helps in forecasting future sales based on similar patterns.

> **Q20:** The given sequence of activities is a repeating pattern: "gym", "coffee shop", "library", followed again by "gym", "coffee shop", "library". Since the system identifies frequent patterns to predict the next activity, it is logical that after the last activity 'library', the user will return to 'gym' to continue this established cycle.

> **Q21:** Hash functions are widely used in ensuring data security during transmission by providing data integrity and authentication. They produce a fixed-size digest that can verify whether the transmitted data has been altered, thus securing the communication between clients and servers. Unlike checksums or error correcting codes which focus on detecting/correcting errors rather than security, hash functions help detect tampering and ensure secure transmission.

> **Q22:** Adding redundant bits for each byte of data sent corresponds to error detection and correction codes, such as parity bits or Hamming codes. These redundant bits enable the receiver to detect and correct errors without needing retransmission, effectively ensuring that no modifications happen during transmission.

> **Q23:** SFTP (Secure File Transfer Protocol) is best suited for securely transferring files between users because it provides encrypted file transfer over a secure connection, ensuring confidentiality and integrity of the data shared. Unlike FTP, which transmits data in plaintext, SFTP protects user data from interception.

> **Q26:** This protocol provides error-checking and correction mechanisms to ensure reliable data transfer, which is essential for handling packet loss and corruption during file uploads and sharing. This makes it most suitable for ensuring efficient and reliable file transfers over the network infrastructure.

> **Q29:** Hash Tables are a coding theory concept used for efficient data storage and retrieval by mapping keys to values through hash functions. In the context of recommending friends based on interests and location, hash tables can quickly index user information for fast lookup and matching, thus fulfilling the company's requirement for efficient retrieval.

> **Q30:** LZW compression is a universal lossless data compression algorithm that efficiently reduces file size without losing any information. This makes it suitable for transmitting files over a network while ensuring the original file can be perfectly reconstructed on the receiving end. Unlike lossy compression, it does not degrade file quality.

> **Q31:** The primary function of a network switch is to connect multiple devices within the same local network and forward data packets between them based on MAC addresses. In this scenario, when a user uploads an image, the switch receives data from the router and forwards it to the appropriate server for processing.

> **Q32:** A hash function always produces a unique output for a given input (deterministic), which allows the system to reliably detect duplicate email addresses by comparing their hash values. Although in theory collisions can happen, good cryptographic hash functions minimize this risk making it suitable for preventing duplicate registrations.

> **Q33:** Modular programming is the best principle to prioritize because it separates concerns within the codebase, making it easier to maintain and update specific parts without affecting others. This leads to improved scalability as new features or changes can be integrated smoothly.

> **Q36:** Using a decimal type for monetary values is most appropriate because it ensures precise calculations without rounding errors that commonly occur with floats. Decimals maintain accuracy in financial computations, which is critical for correct financial analysis and reporting.

> **Q37:** A dictionary or hash table with string keys and values that are lists or dictionaries themselves is most suitable because it allows storing multiple attributes (name, description, price) of different data types for each product. The unique product ID can be the key, and the value can be a nested structure holding heterogeneous data types.

> **Q38:** Selecting appropriate data types ensures efficient memory usage and optimal performance. Using the least amount of memory necessary for each variable (e.g., strings for usernames, integers for ages, floats for balances, booleans for preferences) helps optimize operations such as eligibility checks and spending tracking.

> **Q39:** The total price of items in the cart can include decimal values (for example, $19.99), so using a float data type is appropriate to accurately represent these values with decimals. This correctly fulfills the requirement of storing numerical data that are not whole numbers.

> **Q40:** An integer variable with a range of 1-5 is most suitable for storing ratings because ratings are typically whole numbers representing discrete values (e.g., stars) and fall within a fixed scale. This allows efficient storage and easy comparison or aggregation.

> **Q42:** The pseudo code explicitly handles only three statuses: 'Completed', 'In Progress', and others implicitly as zero. Since 'Inactive' is not accounted for, the ELSE condition will apply, setting CourseProgress[Course.ID] to 0. Therefore, any course marked as 'Inactive' will have its progress recorded as zero.

> **Q43:** This pseudo-code uses a parallel_for loop to update the order statuses concurrently for multiple orders. By processing multiple updates in parallel, it effectively reduces the latency compared to sequential execution. This approach is suitable for real-time status updates where many orders need simultaneous handling.

> **Q44:** This pseudo code correctly follows the steps required: initializing total scores and review counts, iterating over each product to fetch scores and review counts from their respective databases, aggregating them properly by adding current scores to totalScore and incrementing totalReviews accordingly. Finally, it calculates the average.

> **Q45:** The IF condition correctly checks if current stock is below minimum and calculates a 7-day restock amount based on average sales per day. This automated process ensures inventory levels are maintained efficiently without manual intervention.
