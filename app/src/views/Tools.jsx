import React from 'react';
import {
  Text,
  View,
  AsyncStorage,
} from 'react-native';
import {
  Input,
  ButtonGroup,
  Button,
} from 'react-native-elements';
import Icon from 'react-native-vector-icons/FontAwesome';
import { deployment } from 'react-native-dotenv';
import axios from 'axios';
import Pie from './Pie';
import NavBar from './NavBar';

export default class ToolsScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      income: 0,
      selectedIndex: null, // Selected index of the button group for income type
      incomeModifier: 0, // Modifier to divide income by to achieve monthly income
      outcome: 0,
      spent: 0,
      savings: 0,
      firstTime: false, // Field to check if the user has not set up a budget
      update: false, // Field to check if the user is updating their budget
      spend: 0, // Amount to add to the spent value for this budget period
      token: '', // User token
      id: 0, // User's id
    };

    this.getBudgetData = this.getBudgetData.bind(this);
    this.updateIndex = this.updateIndex.bind(this);
    this.updateText = this.updateText.bind(this);
    this.submitBudget = this.submitBudget.bind(this);
    this.submitExpense = this.submitExpense.bind(this);
  }

  componentDidMount() {
    AsyncStorage.getItem('@token') // Retrieve token stored from login
      .then((token) => {
        this.setState({ token });
      })
      .then(() => {
        this.getBudgetData();
      });
  }

  // Retrieves the budget attached to the user id
  getBudgetData() {
    const { token } = this.state;
    axios.get(`http://${deployment}:8080/profile/user/${token}`) // Retrieve user info from token
      .then((profileData) => {
        this.setState({ id: profileData.data.id });
        const { id } = this.state;
        return axios.get(`http://${deployment}:8080/tool/budget/${id}`); // Retrieve budget info from user id
      })
      .then((budget) => {
        // if there is no budget data, send the user through first time setup
        if (!budget.data) {
          this.setState({
            firstTime: true,
          });
        } else {
          this.setState({
            income: budget.data.income,
            outcome: budget.data.outcome,
            spent: budget.data.spent,
            savings: budget.data.savings,
            incomeModifier: budget.data.incomeModifier,
          });

          // To automatically set the index of the Button group for selecting the income type
          if (budget.data.incomeModifier === 0.25) {
            this.setState({ selectedIndex: 0 });
          } else if (budget.data.incomeModifier === 0.5) {
            this.setState({ selectedIndex: 1 });
          } else if (budget.data.incomeModifier === 1) {
            this.setState({ selectedIndex: 2 });
          } else if (budget.data.incomeModifier === 12) {
            this.setState({ selectedIndex: 3 });
          }
        }
      });
  }

  // Update handler for the type of payment button group
  updateIndex(selectedIndex) {
    // Takes index from ButtonGroup assigning it to state
    this.setState({ selectedIndex });
    // Values put in correspond to the income modifier to change the income to monthly value
    if (selectedIndex === 0) {
      this.setState({ incomeModifier: 0.25 });
    } else if (selectedIndex === 1) {
      this.setState({ incomeModifier: 0.5 });
    } else if (selectedIndex === 2) {
      this.setState({ incomeModifier: 1 });
    } else if (selectedIndex === 3) {
      this.setState({ incomeModifier: 12 });
    }
  }

  // update handler for all the text fields for creating a budget
  updateText(element, value) {
    if (element === 'income') {
      this.setState({ income: Number(value) });
    } else if (element === 'outcome') {
      this.setState({ outcome: Number(value) });
    } else if (element === 'savings') {
      this.setState({ savings: Number(value) });
    } else if (element === 'spend') {
      this.setState({ spend: Number(value) });
    }
  }

  // Submition for a new budget or an updated budget
  submitBudget() {
    // State values
    const {
      income,
      outcome,
      incomeModifier,
      savings,
      firstTime,
      update,
      id,
    } = this.state;

    // Determine if the submition is for first time setup or update
    if (firstTime) { // Submit a new budget
      axios.post(`http://${deployment}:8080/tool/budget/${id}`, {
        income,
        outcome,
        incomeModifier,
        savings,
      })
        .then(() => {
          this.setState({ firstTime: false });
        });
    } else if (update) { // Update a budget
      axios.patch(`http://${deployment}:8080/tool/budget/${id}`, {
        income,
        outcome,
        incomeModifier,
        savings,
      })
        .then(() => {
          this.setState({ update: false });
        });
    }
  }

  // Submit an expense to the budget
  submitExpense() {
    const { id } = this.state;
    let { spend } = this.state;
    spend = Math.round(spend * 100) / 100; // To round the value to 2 decimal places
    axios.patch(`http://${deployment}:8080/tool/budget/spend/${id}`, {
      spend,
    })
      .then(() => {
        this.getBudgetData();
        this.setState({ spend: 0 });
      });
  }

  render() {
    // State values
    const {
      income,
      selectedIndex,
      outcome,
      spent,
      savings,
      firstTime,
      incomeModifier,
      spend,
      update,
    } = this.state;
    const { navigation } = this.props;
    const buttons = ['Weekly', 'Biweekly', 'Monthly', 'Yearly'];

    // Budget Math
    const monthly = income / incomeModifier;
    const disposableIncome = monthly - (outcome + savings);
    const weeklyDisposable = disposableIncome / 4;
    const leftover = weeklyDisposable - spent;

    // Display for the first time setup for the budget
    const setup = (
      <View>
        <Input // Input for user income
          label="Income"
          onChangeText={(text) => this.updateText('income', text)}
          value={income === 0 ? null : income.toString()}
          placeholder="Gimme ur $"
        />
        <ButtonGroup // Button group to determine what kind of income user has (weekly/monthly etc)
          onPress={this.updateIndex}
          selectedIndex={selectedIndex}
          buttons={buttons}
          containerStyle={{ height: 40 }}
        />
        <Input // Input for user outcome
          label="Monthly Expenses"
          onChangeText={(text) => this.updateText('outcome', text)}
          value={outcome === 0 ? null : outcome.toString()}
          placeholder="Rent, electricity, internet"
        />
        <Input // Input for user savings
          label="Savings"
          onChangeText={(text) => this.updateText('savings', text)}
          value={savings === 0 ? null : savings.toString()}
          placeholder={`We recommend 25% of net worth: ${Math.floor(((income / incomeModifier) - outcome) * 0.25)}`}
        />
        <Button // Button to submit all budget data to server
          title="Submit"
          onPress={this.submitBudget}
        />
      </View>
    );

    // Display for the budget
    const budget = (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Pie // Pie chart display
            pieWidth={200}
            pieHeight={200}
            colors={['#1f77b4', '#ff7f0e']}
            width={250}
            height={250}
            data={[
              { number: leftover - spent },
              { number: spent },
            ]}
          />
        </View>
        <View style={{
          flex: 2,
          alignSelf: 'center',
          width: '50%',
        }}
        >
          <Text>
            {`Weekly budget: $${Math.round(weeklyDisposable * 100) / 100}`}
          </Text>
          <Text>{`Total spent: $${Math.round(spent * 100) / 100}`}</Text>
          <Input // Input for user income
            label="Expense"
            leftIcon={<Icon name="dollar" />}
            onChangeText={(text) => this.updateText('spend', text)}
            value={spend.toString()}
            errorStyle={{ color: 'red' }}
            // errorMessage="ENTER A VALID ERROR HERE"
          />
          <Button // Button to send new expense
            title="Spend"
            onPress={this.submitExpense}
          />
          <Button // Button to send new expense
            style={{
              marginTop: 10,
            }}
            title="Update Budget"
            onPress={() => this.setState({ update: true })}
          />
        </View>
      </View>
    );

    return (
      <View style={{ flex: 1 }}>
        <NavBar navigation={navigation} />
        {firstTime || update ? setup : budget}
      </View>
    );
  }
}
