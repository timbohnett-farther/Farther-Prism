import { useState, useEffect } from 'react';
import { User, Mail, Calendar, DollarSign, Target } from 'lucide-react';

export default function ClientOnboarding({ data, onUpdate, onNext, isFirst }) {
  const [formData, setFormData] = useState(data.clientData || {
    firstName: '',
    lastName: '',
    email: '',
    age: '',
    retirementAge: 65,
    currentSavings: '',
    annualIncome: '',
    monthlyExpenses: '',
    retirementGoal: '',
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.age || formData.age < 18 || formData.age > 100) newErrors.age = 'Valid age required';
    if (!formData.currentSavings || formData.currentSavings < 0) newErrors.currentSavings = 'Current savings required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onUpdate('clientData', formData);
      onNext();
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-farther-navy mb-2">Client Information</h2>
        <p className="text-farther-gray-600">Let's start by gathering some basic information about your client.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <User className="inline w-4 h-4 mr-1" />
              First Name
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.firstName ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="John"
            />
            {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <User className="inline w-4 h-4 mr-1" />
              Last Name
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.lastName ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="Smith"
            />
            {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <Mail className="inline w-4 h-4 mr-1" />
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.email ? 'border-red-500' : 'border-slate-300'
            }`}
            placeholder="john.smith@example.com"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        {/* Age & Retirement Age */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Current Age
            </label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) => handleChange('age', parseInt(e.target.value))}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.age ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="45"
            />
            {errors.age && <p className="mt-1 text-sm text-red-600">{errors.age}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Target className="inline w-4 h-4 mr-1" />
              Target Retirement Age
            </label>
            <input
              type="number"
              value={formData.retirementAge}
              onChange={(e) => handleChange('retirementAge', parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="65"
            />
          </div>
        </div>

        {/* Financial Information */}
        <div className="border-t border-slate-200 pt-6 mt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Financial Overview</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <DollarSign className="inline w-4 h-4 mr-1" />
                Current Savings / Portfolio Value
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-500">$</span>
                <input
                  type="number"
                  value={formData.currentSavings}
                  onChange={(e) => handleChange('currentSavings', parseFloat(e.target.value))}
                  className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.currentSavings ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="500,000"
                />
              </div>
              {errors.currentSavings && <p className="mt-1 text-sm text-red-600">{errors.currentSavings}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <DollarSign className="inline w-4 h-4 mr-1" />
                Retirement Income Goal (Annual)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-500">$</span>
                <input
                  type="number"
                  value={formData.retirementGoal}
                  onChange={(e) => handleChange('retirementGoal', parseFloat(e.target.value))}
                  className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="80,000"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-end pt-6 border-t border-slate-200 mt-8">
          <button
            type="submit"
            className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Continue to Portfolio
          </button>
        </div>
      </form>
    </div>
  );
}
